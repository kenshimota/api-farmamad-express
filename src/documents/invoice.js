const { invoiceService } = require("../invoices/service");
const { invoicePaymentService } = require("../invoice-payments/service");
const { round2 } = require("../invoice-payments/calculations");
const { readField } = require("../shared/serializer");
const { documentRepository } = require("./repository");

/**
 * Converts a timestamp into an ISO string.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The ISO timestamp or null.
 */
function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Serializes a DATEONLY value.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The `YYYY-MM-DD` value or null.
 */
function toDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

/**
 * Builds one invoice line snapshot for the PDF.
 * @param {object} item - Invoice item instance or plain object.
 * @returns {object} The line data.
 */
function toDocumentItem(item) {
  return {
    product_name: readField(item, "product_name"),
    product_reference: readField(item, "product_reference"),
    item_state_name: readField(item, "item_state_name"),
    quantity: Number(readField(item, "quantity")),
    unit_price: round2(readField(item, "unit_price")),
    subtotal: round2(readField(item, "subtotal")),
  };
}

/**
 * Builds the summarized payment history of an invoice. Wallet balances and
 * internal users are intentionally excluded.
 * @param {object[]} payments - Payment allocations with their payment method.
 * @returns {object[]} The payment rows.
 */
function toDocumentPayments(payments) {
  return payments.map((allocation) => {
    const payment = readField(allocation, "payment");
    const currency = payment ? readField(payment, "currency") : null;
    const method = payment ? readField(payment, "method_payment") : null;

    return {
      allocated_at: toIso(readField(allocation, "allocated_at")),
      amount: round2(readField(allocation, "amount")),
      currency: currency
        ? {
            code: readField(currency, "code"),
            name: readField(currency, "name"),
            symbol: readField(currency, "symbol"),
          }
        : null,
      applied_amount: round2(readField(allocation, "applied_amount")),
      method: method ? readField(method, "label") : null,
    };
  });
}

/**
 * Builds the invoice PDF document data from the immutable snapshot.
 * @param {object} input - Document input.
 * @param {object} input.invoice - Invoice with snapshots and relations.
 * @param {object[]} input.payments - Applied payment allocations.
 * @param {object|null} input.order - Order projection with its number.
 * @param {unknown} input.generatedAt - Generation timestamp.
 * @returns {object} The invoice document data.
 */
function buildInvoiceDocument({ invoice, payments, order, generatedAt }) {
  const customer = readField(invoice, "customer");
  const currency = readField(invoice, "currency");
  const paymentTerm = readField(invoice, "payment_term");
  const items = readField(invoice, "items");
  const total = round2(readField(invoice, "total"));
  const paidAmount = round2(readField(invoice, "paid_amount"));

  return {
    generated_at: toIso(generatedAt),
    order_number: order ? Number(readField(order, "number")) : null,
    invoice: {
      id: Number(readField(invoice, "id")),
      number: Number(readField(invoice, "number")),
      payment_status: readField(invoice, "payment_status"),
      subtotal: round2(readField(invoice, "subtotal")),
      tax_amount: round2(readField(invoice, "tax_amount")),
      total,
      paid_amount: paidAmount,
      balance_due: round2(total - paidAmount),
      issued_at: toIso(readField(invoice, "issued_at")),
      due_date: toDateOnly(readField(invoice, "due_date")),
      notes: readField(invoice, "notes"),
    },
    customer: customer
      ? {
          fullName: readField(customer, "fullName"),
          email: readField(customer, "email"),
          direction: readField(customer, "direction"),
        }
      : null,
    payment_term: paymentTerm
      ? {
          name: readField(paymentTerm, "name"),
          days: Number(readField(paymentTerm, "days")),
        }
      : null,
    currency: currency
      ? {
          id: Number(readField(currency, "id")),
          code: readField(currency, "code"),
          name: readField(currency, "name"),
          symbol: readField(currency, "symbol"),
          rate: Number(readField(currency, "rate")),
        }
      : null,
    items: Array.isArray(items) ? items.map(toDocumentItem) : [],
    payments: toDocumentPayments(payments),
  };
}

/**
 * Creates the invoice PDF data service.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.invoiceService] - Invoices service.
 * @param {object} [dependencies.invoicePaymentService] - Invoice payments.
 * @param {object} [dependencies.repository] - Document repository.
 * @param {Function} [dependencies.clock] - Clock for the generation timestamp.
 * @returns {object} The invoice document service.
 */
function createInvoiceDocumentService({
  invoiceService: invoices = invoiceService,
  invoicePaymentService: payments = invoicePaymentService,
  repository = documentRepository,
  clock = () => new Date(),
} = {}) {
  return {
    /**
     * Loads an invoice, validates the access rules and builds the document.
     * @param {number} invoiceId - Invoice id.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The invoice document data.
     */
    async getInvoiceDocument(invoiceId, actor) {
      const invoice = await invoices.getInvoice(invoiceId, actor);
      const allocations = await payments.listInvoicePayments(invoiceId, actor);
      const orderId = readField(invoice, "order_id");
      const order =
        orderId === null || orderId === undefined
          ? null
          : await repository.findOrderNumber(orderId);

      return buildInvoiceDocument({
        invoice,
        payments: allocations,
        order,
        generatedAt: clock(),
      });
    },
  };
}

const invoiceDocumentService = createInvoiceDocumentService();

module.exports = {
  buildInvoiceDocument,
  createInvoiceDocumentService,
  invoiceDocumentService,
  toDocumentItem,
  toDocumentPayments,
};
