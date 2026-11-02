const sequelize = require("../database");
const PaymentAllocation = require("../models/payment-allocation");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const Currency = require("../models/currency");
const MethodPayment = require("../models/method-payment");
const MethodPaymentType = require("../models/method-payment-type");
const User = require("../models/user");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

const LIST_ORDER = Object.freeze([
  ["allocated_at", "ASC"],
  ["id", "ASC"],
]);
const CURRENCY_ATTRIBUTES = Object.freeze([
  ...CURRENCY_SUMMARY_ATTRIBUTES,
  "rate",
]);
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_ATTRIBUTES],
});
const PAYMENT_INCLUDE = Object.freeze({
  model: Payment,
  as: "payment",
  attributes: ["id", "currency_id", "method_payment_id"],
  include: [
    CURRENCY_INCLUDE,
    {
      model: MethodPayment,
      as: "method_payment",
      attributes: ["id", "label"],
      include: [
        {
          model: MethodPaymentType,
          as: "method_payment_type",
          attributes: ["id", "code", "name"],
        },
      ],
    },
  ],
});
const CREATED_BY_INCLUDE = Object.freeze({
  model: User,
  as: "created_by",
  attributes: ["id", "username", "email"],
});

/**
 * Creates the repository that encapsulates every persistence call of the
 * invoice payments module. Models and the connection are injectable so the
 * service can be unit tested with doubles.
 * @param {object} [options] - Injectable dependencies.
 * @returns {object} Invoice payment repository.
 */
function createInvoicePaymentRepository({
  model = PaymentAllocation,
  invoiceModel = Invoice,
  paymentModel = Payment,
  walletModel = CustomerWallet,
  transactionModel = WalletTransaction,
  currencyModel = Currency,
  userModel = User,
  connection = sequelize,
} = {}) {
  const currencyInclude = {
    ...CURRENCY_INCLUDE,
    model: currencyModel,
  };
  const paymentInclude = {
    ...PAYMENT_INCLUDE,
    model: paymentModel,
    include: [currencyInclude, ...PAYMENT_INCLUDE.include.slice(1)],
  };

  return {
    /**
     * Runs a callback inside one database transaction.
     * @param {(transaction: object) => Promise<unknown>} callback - Work.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return connection.transaction(callback);
    },

    /**
     * Loads and locks the invoice being paid.
     * @param {number} id - Invoice id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked invoice or null.
     */
    async findInvoiceForUpdate(id, transaction) {
      const invoice = await invoiceModel.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!invoice) {
        return null;
      }

      const currency = await currencyModel.findByPk(invoice.currency_id, {
        transaction,
      });

      if (currency) {
        invoice.setDataValue("currency", currency);
      }

      return invoice;
    },

    /**
     * Loads and locks the payment being allocated.
     * @param {number} id - Payment id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked payment or null.
     */
    async findPaymentForUpdate(id, transaction) {
      const payment = await paymentModel.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!payment) {
        return null;
      }

      const currency = await currencyModel.findByPk(payment.currency_id, {
        transaction,
      });

      if (currency) {
        payment.setDataValue("currency", currency);
      }

      return payment;
    },

    /**
     * Finds an existing allocation of the same payment to the same invoice.
     * @param {number} paymentId - Payment id.
     * @param {number} invoiceId - Invoice id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The allocation or null.
     */
    findAllocation(paymentId, invoiceId, transaction) {
      return model.findOne({
        where: { payment_id: paymentId, invoice_id: invoiceId },
        transaction,
      });
    },

    /**
     * Loads and locks the wallet debited by the allocation.
     * @param {number} customerId - Customer id.
     * @param {number} currencyId - Payment currency id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked wallet or null.
     */
    findWalletForUpdate(customerId, currencyId, transaction) {
      return walletModel.findOne({
        where: { customer_id: customerId, currency_id: currencyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    },

    /**
     * Persists one immutable allocation.
     * @param {object} values - Allocation attributes.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The created allocation.
     */
    createAllocation(values, options) {
      return model.create(values, options);
    },

    /**
     * Decrements the wallet balance and reloads the row.
     * @param {object} wallet - Locked wallet.
     * @param {number} amount - Positive amount to debit.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The reloaded wallet.
     */
    async debitWallet(wallet, amount, options) {
      await wallet.increment("balance", {
        by: -Math.abs(Number(amount)),
        transaction: options.transaction,
      });

      return wallet.reload({ transaction: options.transaction });
    },

    /**
     * Appends the `invoice_payment` wallet movement.
     * @param {object} values - Movement attributes.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The created movement.
     */
    createWalletTransaction(values, options) {
      return transactionModel.create(values, options);
    },

    /**
     * Updates the invoice paid amount and payment status.
     * @param {object} invoice - Locked invoice.
     * @param {object} values - Attributes to persist.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The updated invoice.
     */
    updateInvoice(invoice, values, options) {
      return invoice.update(values, options);
    },

    /**
     * Reloads an allocation with its payment, method and currency.
     * @param {number} id - Allocation id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The allocation or null.
     */
    reloadAllocation(id, transaction) {
      return model.findByPk(id, {
        include: [paymentInclude],
        transaction,
      });
    },

    /**
     * Loads an invoice to apply the history access rules.
     * @param {number} id - Invoice id.
     * @returns {Promise<object|null>} The invoice or null.
     */
    findInvoiceById(id) {
      return invoiceModel.findByPk(id);
    },

    /**
     * Loads the authenticated actor from `users`.
     * @param {number} id - User id.
     * @param {object} [transaction] - Open transaction.
     * @returns {Promise<object|null>} The user or null.
     */
    findUserById(id, transaction) {
      return userModel.findByPk(id, { transaction });
    },

    /**
     * Lists the allocations of an invoice ordered by allocation time and id.
     * @param {number} invoiceId - Invoice id.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.includeCreatedBy] - Nest the staff user.
     * @returns {Promise<object[]>} The allocations.
     */
    listAllocations(invoiceId, { includeCreatedBy = false } = {}) {
      const include = [paymentInclude];

      if (includeCreatedBy) {
        include.push(CREATED_BY_INCLUDE);
      }

      return model.findAll({
        where: { invoice_id: invoiceId },
        order: LIST_ORDER,
        include,
      });
    },
  };
}

const invoicePaymentRepository = createInvoicePaymentRepository();

module.exports = {
  CURRENCY_INCLUDE,
  LIST_ORDER,
  PAYMENT_INCLUDE,
  createInvoicePaymentRepository,
  invoicePaymentRepository,
};
