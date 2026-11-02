const { readField } = require("../shared/serializer");
const { customerProfileNotLinked, forbidden } = require("../invoices/errors");
const {
  amountExceedsInvoiceBalance,
  insufficientWalletBalance,
  invoiceAlreadyPaid,
  invoiceNotFound,
  paymentAlreadyAllocated,
  paymentCustomerMismatch,
  paymentNotFound,
} = require("./errors");
const {
  calculateAppliedAmount,
  calculateExchangeRate,
  calculatePaymentStatus,
  round2,
  toCents,
} = require("./calculations");
const { invoicePaymentRepository } = require("./repository");

const STAFF_ROLES = Object.freeze(["admin", "seller"]);

/**
 * Resolves the access scope of the invoice payment history.
 * @param {object} repository - Invoice payment repository.
 * @param {object} actor - JWT payload.
 * @returns {Promise<{ includeCreatedBy: boolean, customerId: number|null }>}
 *   The viewer scope.
 * @throws {Error} 403 when the role is not allowed or the customer is unlinked.
 */
async function resolveViewer(repository, actor) {
  const role = actor?.role;

  if (STAFF_ROLES.includes(role)) {
    return { includeCreatedBy: true, customerId: null };
  }

  if (role !== "customer") {
    throw forbidden();
  }

  const user = await repository.findUserById(actor.sub, undefined);
  const customerId = user ? readField(user, "customer_id") : null;

  if (customerId === null || customerId === undefined) {
    throw customerProfileNotLinked();
  }

  return { includeCreatedBy: false, customerId: Number(customerId) };
}

/**
 * Creates the invoice payments service. Every business rule and the atomic
 * wallet update lives here so routers only parse, authorize and serialize.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Invoice payment repository.
 * @param {function(): Date} [dependencies.clock] - Clock for `allocated_at`.
 * @returns {object} The invoice payments service.
 */
function createInvoicePaymentService({
  repository = invoicePaymentRepository,
  clock = () => new Date(),
} = {}) {
  return {
    /**
     * Applies one received payment to one invoice inside a single transaction.
     * It locks the invoice, payment and wallet, validates ownership and
     * balances, creates the allocation, debits the wallet, appends the
     * `invoice_payment` movement and updates `paid_amount`/`payment_status`.
     * @param {number} invoiceId - Invoice id.
     * @param {object} values - Validated `payment_id` and `amount`.
     * @param {number} userId - Authenticated user id.
     * @returns {Promise<{ allocation: object, invoice: object }>} The created
     *   allocation and the updated invoice.
     * @throws {Error} 404/409/422 for a rejected application.
     */
    applyPayment(invoiceId, values, userId) {
      return repository.transaction(async (transaction) => {
        const options = { transaction };
        const invoice = await repository.findInvoiceForUpdate(
          invoiceId,
          transaction,
        );

        if (!invoice) {
          throw invoiceNotFound();
        }

        const payment = await repository.findPaymentForUpdate(
          values.payment_id,
          transaction,
        );

        if (!payment) {
          throw paymentNotFound();
        }

        if (
          Number(readField(payment, "customer_id")) !==
          Number(readField(invoice, "customer_id"))
        ) {
          throw paymentCustomerMismatch();
        }

        if (
          readField(invoice, "payment_status") === "paid" ||
          toCents(readField(invoice, "paid_amount")) >=
            toCents(readField(invoice, "total"))
        ) {
          throw invoiceAlreadyPaid();
        }

        const existing = await repository.findAllocation(
          readField(payment, "id"),
          readField(invoice, "id"),
          transaction,
        );

        if (existing) {
          throw paymentAlreadyAllocated();
        }

        const amount = round2(values.amount);
        const paymentCurrency = readField(payment, "currency");
        const invoiceCurrency = readField(invoice, "currency");
        const exchangeRate = calculateExchangeRate(
          readField(paymentCurrency, "rate"),
          readField(invoiceCurrency, "rate"),
        );
        const appliedAmount = calculateAppliedAmount(amount, exchangeRate);
        const balanceDue = round2(
          Number(readField(invoice, "total")) -
            Number(readField(invoice, "paid_amount")),
        );

        if (toCents(appliedAmount) > toCents(balanceDue)) {
          throw amountExceedsInvoiceBalance();
        }

        const wallet = await repository.findWalletForUpdate(
          readField(invoice, "customer_id"),
          readField(payment, "currency_id"),
          transaction,
        );

        if (
          !wallet ||
          toCents(readField(wallet, "balance")) < toCents(amount)
        ) {
          throw insufficientWalletBalance();
        }

        const allocation = await repository.createAllocation(
          {
            payment_id: readField(payment, "id"),
            invoice_id: readField(invoice, "id"),
            amount,
            applied_amount: appliedAmount,
            exchange_rate: exchangeRate,
            allocated_at: clock(),
            created_by_user_id: userId,
          },
          options,
        );
        const debitedWallet = await repository.debitWallet(
          wallet,
          amount,
          options,
        );

        await repository.createWalletTransaction(
          {
            wallet_id: readField(wallet, "id"),
            transaction_type: "invoice_payment",
            amount: -amount,
            balance_after: readField(debitedWallet, "balance"),
            payment_id: readField(payment, "id"),
            invoice_id: readField(invoice, "id"),
            payment_allocation_id: readField(allocation, "id"),
            description: null,
            created_by_user_id: userId,
          },
          options,
        );

        const paidAmount = round2(
          Number(readField(invoice, "paid_amount")) + appliedAmount,
        );
        const updatedInvoice = await repository.updateInvoice(
          invoice,
          {
            paid_amount: paidAmount,
            payment_status: calculatePaymentStatus(
              paidAmount,
              readField(invoice, "total"),
            ),
          },
          options,
        );

        return {
          allocation: await repository.reloadAllocation(
            readField(allocation, "id"),
            transaction,
          ),
          invoice: updatedInvoice,
        };
      });
    },

    /**
     * Lists the allocation history of one invoice. Staff see every invoice and
     * the author of each allocation; a customer only sees its own invoice and
     * never the internal user.
     * @param {number} invoiceId - Invoice id.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object[]>} The allocations ordered ascending.
     * @throws {Error} 403/404 for an unauthorized or unknown invoice.
     */
    async listInvoicePayments(invoiceId, actor) {
      const viewer = await resolveViewer(repository, actor);
      const invoice = await repository.findInvoiceById(invoiceId);

      if (!invoice) {
        throw invoiceNotFound();
      }

      if (
        viewer.customerId !== null &&
        Number(readField(invoice, "customer_id")) !== viewer.customerId
      ) {
        throw invoiceNotFound();
      }

      return repository.listAllocations(invoiceId, {
        includeCreatedBy: viewer.includeCreatedBy,
      });
    },
  };
}

const invoicePaymentService = createInvoicePaymentService();

module.exports = {
  STAFF_ROLES,
  calculateAppliedAmount,
  calculateExchangeRate,
  calculatePaymentStatus,
  createInvoicePaymentService,
  invoicePaymentService,
  resolveViewer,
  round2,
  toCents,
};
