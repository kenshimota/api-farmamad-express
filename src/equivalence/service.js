const { orderService } = require("../orders/service");
const { invoiceService } = require("../invoices/service");
const { readField } = require("../shared/serializer");
const { equivalenceRepository } = require("./repository");
const { convertAmount, round2 } = require("./calculations");
const {
  RATE_SOURCE,
  isCash,
  rateMetadata,
  resolveCurrencies,
  sortLines,
} = require("./context");
const {
  toDateOnly,
  toInvoiceLine,
  toIso,
  toMoney,
  toOrderLine,
  toPublicCurrency,
  toPublicPaymentTerm,
} = require("./serializer");

/**
 * Creates the equivalence service. Orders and invoices are loaded through
 * their existing services so authentication, ownership and hidden-404 rules
 * stay in one place.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Rates repository.
 * @param {object} [dependencies.orders] - Orders service.
 * @param {object} [dependencies.invoices] - Invoices service.
 * @param {function(): Date} [dependencies.clock] - Server clock.
 * @returns {object} The equivalence service.
 */
function createEquivalenceService({
  repository = equivalenceRepository,
  orders = orderService,
  invoices = invoiceService,
  clock = () => new Date(),
} = {}) {
  /**
   * Builds the read-only order equivalence.
   * @param {number} orderId - Order id.
   * @param {object} actor - JWT payload.
   * @param {number} [currencyId] - Optional target currency id.
   * @returns {Promise<object>} The equivalence response.
   */
  async function getOrderEquivalence(orderId, actor, currencyId) {
    const { order } = await orders.getOrder(orderId, actor);
    const context = await resolveCurrencies(
      repository,
      readField(order, "currency_id"),
      currencyId,
    );
    const items = readField(order, "items") ?? [];
    const lines = sortLines(
      items.map((item) => toOrderLine(item, context.exchangeRate)),
    );
    const subtotalTarget = convertAmount(
      readField(order, "subtotal"),
      context.exchangeRate,
    );
    const totalTarget = convertAmount(
      readField(order, "total"),
      context.exchangeRate,
    );
    const linesSubtotalTarget = round2(
      lines.reduce((sum, line) => sum + line.subtotal_target, 0),
    );
    const paymentTerm = readField(order, "payment_term");

    return {
      resource: "order",
      order: {
        id: readField(order, "id"),
        number: readField(order, "number"),
        status: readField(order, "status"),
        customer_id: readField(order, "customer_id"),
        created_at: toIso(readField(order, "createdAt")),
      },
      payment_term: toPublicPaymentTerm(paymentTerm),
      source: {
        currency: toPublicCurrency(context.source),
        subtotal: toMoney(readField(order, "subtotal")),
        total: toMoney(readField(order, "total")),
      },
      target: {
        currency: toPublicCurrency(context.target),
        subtotal: subtotalTarget,
        total: totalTarget,
      },
      ...rateMetadata(context, clock()),
      rounding_adjustment: round2(subtotalTarget - linesSubtotalTarget),
      payment: {
        is_cash: isCash(paymentTerm),
        amount_due_source: toMoney(readField(order, "total")),
        amount_due_target: totalTarget,
      },
      lines,
    };
  }

  /**
   * Builds the read-only invoice equivalence.
   * @param {number} invoiceId - Invoice id.
   * @param {object} actor - JWT payload.
   * @param {number} [currencyId] - Optional target currency id.
   * @returns {Promise<object>} The equivalence response.
   */
  async function getInvoiceEquivalence(invoiceId, actor, currencyId) {
    const invoice = await invoices.getInvoice(invoiceId, actor);
    const context = await resolveCurrencies(
      repository,
      readField(invoice, "currency_id"),
      currencyId,
    );
    const items = readField(invoice, "items") ?? [];
    const lines = sortLines(
      items.map((item) => toInvoiceLine(item, context.exchangeRate)),
    );
    const totalSource = toMoney(readField(invoice, "total"));
    const paidSource = toMoney(readField(invoice, "paid_amount"));
    const balanceSource = round2(totalSource - paidSource);
    const subtotalTarget = convertAmount(
      readField(invoice, "subtotal"),
      context.exchangeRate,
    );
    const totalTarget = convertAmount(
      readField(invoice, "total"),
      context.exchangeRate,
    );
    const balanceTarget = convertAmount(balanceSource, context.exchangeRate);
    const linesSubtotalTarget = round2(
      lines.reduce((sum, line) => sum + line.subtotal_target, 0),
    );
    const paymentTerm = readField(invoice, "payment_term");
    const orderId = readField(invoice, "order_id");

    return {
      resource: "invoice",
      invoice: {
        id: readField(invoice, "id"),
        number: readField(invoice, "number"),
        order_id: orderId ?? null,
        order_number: orderId
          ? await repository.findOrderNumber(orderId)
          : null,
        payment_status: readField(invoice, "payment_status"),
        issued_at: toIso(readField(invoice, "issued_at")),
        due_date: toDateOnly(readField(invoice, "due_date")),
      },
      payment_term: toPublicPaymentTerm(paymentTerm),
      source: {
        currency: toPublicCurrency(context.source),
        subtotal: toMoney(readField(invoice, "subtotal")),
        tax_amount: toMoney(readField(invoice, "tax_amount")),
        total: totalSource,
        paid_amount: paidSource,
        balance_due: balanceSource,
      },
      target: {
        currency: toPublicCurrency(context.target),
        subtotal: subtotalTarget,
        tax_amount: convertAmount(
          readField(invoice, "tax_amount"),
          context.exchangeRate,
        ),
        total: totalTarget,
        paid_amount: convertAmount(
          readField(invoice, "paid_amount"),
          context.exchangeRate,
        ),
        balance_due: balanceTarget,
      },
      ...rateMetadata(context, clock()),
      rounding_adjustment: round2(totalTarget - linesSubtotalTarget),
      payment: {
        is_cash: isCash(paymentTerm),
        amount_due_source: balanceSource,
        amount_due_target: balanceTarget,
      },
      lines,
    };
  }

  return { getInvoiceEquivalence, getOrderEquivalence };
}

const equivalenceService = createEquivalenceService();

module.exports = {
  RATE_SOURCE,
  createEquivalenceService,
  equivalenceService,
  resolveCurrencies,
};
