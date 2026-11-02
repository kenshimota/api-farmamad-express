const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Converts a DECIMAL value into a JSON number with two decimals.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric value or null.
 */
function toMoneyNumber(value) {
  return toDecimalNumber(value, 2);
}

/**
 * Serializes a timestamp as an ISO string, keeping strings untouched.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The timestamp or null.
 */
function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Serializes a DATEONLY value as `YYYY-MM-DD`.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The date or null.
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
 * Builds the customer nested in an invoice without coordinates or audit data.
 * @param {object} customer - Customer instance or plain object.
 * @returns {{ id: number, fullName: string, email: string,
 *   direction: string }} Public customer summary.
 */
function toPublicCustomerSummary(customer) {
  return {
    id: readField(customer, "id"),
    fullName: readField(customer, "fullName"),
    email: readField(customer, "email"),
    direction: readField(customer, "direction"),
  };
}

/**
 * Builds the compact currency nested in an invoice.
 * @param {object} currency - Currency instance or plain object.
 * @returns {{ id: number, code: string, name: string, symbol: string }}
 *   Public currency summary.
 */
function toPublicCurrencySummary(currency) {
  return {
    id: readField(currency, "id"),
    code: readField(currency, "code"),
    name: readField(currency, "name"),
    symbol: readField(currency, "symbol"),
  };
}

/**
 * Builds the payment term snapshot nested in an invoice.
 * @param {object} paymentTerm - Payment term instance or plain object.
 * @returns {{ id: number, code: string, name: string, days: number }}
 *   Public payment term summary.
 */
function toPublicPaymentTerm(paymentTerm) {
  return {
    id: readField(paymentTerm, "id"),
    code: readField(paymentTerm, "code"),
    name: readField(paymentTerm, "name"),
    days: readField(paymentTerm, "days"),
  };
}

/**
 * Builds the internal user who issued the invoice. Only admin and seller
 * responses include it.
 * @param {object} user - User instance or plain object.
 * @returns {{ id: number, username: string, email: string }} Public user.
 */
function toPublicInvoicedBy(user) {
  return {
    id: readField(user, "id"),
    username: readField(user, "username"),
    email: readField(user, "email"),
  };
}

/**
 * Builds the public representation of an invoice line snapshot.
 * @param {object} item - Invoice item instance or plain object.
 * @returns {object} Public line data.
 */
function toPublicInvoiceItem(item) {
  return {
    order_item_id: readField(item, "order_item_id"),
    product_id: readField(item, "product_id"),
    product_name: readField(item, "product_name"),
    product_reference: readField(item, "product_reference"),
    item_state_id: readField(item, "item_state_id"),
    item_state_name: readField(item, "item_state_name"),
    quantity: readField(item, "quantity"),
    unit_price: toMoneyNumber(readField(item, "unit_price")),
    subtotal: toMoneyNumber(readField(item, "subtotal")),
  };
}

/**
 * Builds the public representation of an invoice. Items and `invoiced_by` are
 * nested only when requested; customer, currency and payment term are nested
 * when the repository loaded them.
 * @param {object} invoice - Invoice instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeItems] - Nest the line snapshots.
 * @param {boolean} [options.includeInvoicedBy] - Expose the internal user.
 * @returns {object} Public invoice data.
 */
function toPublicInvoice(
  invoice,
  { includeItems = false, includeInvoicedBy = false } = {},
) {
  const customer = readField(invoice, "customer");
  const currency = readField(invoice, "currency");
  const paymentTerm = readField(invoice, "payment_term");
  const invoicedBy = readField(invoice, "invoiced_by");
  const order = readField(invoice, "order");
  const items = readField(invoice, "items");
  const total = toMoneyNumber(readField(invoice, "total"));
  const paidAmount = toMoneyNumber(readField(invoice, "paid_amount"));
  const balanceDue =
    total === null || paidAmount === null
      ? null
      : Number((total - paidAmount).toFixed(2));
  const data = {
    id: readField(invoice, "id"),
    number: readField(invoice, "number"),
    order_id: readField(invoice, "order_id"),
    order_number: order ? readField(order, "number") : null,
    customer_id: readField(invoice, "customer_id"),
    currency_id: readField(invoice, "currency_id"),
    payment_term_id: readField(invoice, "payment_term_id"),
    subtotal: toMoneyNumber(readField(invoice, "subtotal")),
    tax_amount: toMoneyNumber(readField(invoice, "tax_amount")),
    total,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    payment_status: readField(invoice, "payment_status"),
    issued_at: toIso(readField(invoice, "issued_at")),
    due_date: toDateOnly(readField(invoice, "due_date")),
    notes: readField(invoice, "notes"),
  };

  if (customer) {
    data.customer = toPublicCustomerSummary(customer);
  }

  if (currency) {
    data.currency = toPublicCurrencySummary(currency);
  }

  if (paymentTerm) {
    data.payment_term = toPublicPaymentTerm(paymentTerm);
  }

  if (includeInvoicedBy && invoicedBy) {
    data.invoiced_by = toPublicInvoicedBy(invoicedBy);
  }

  if (includeItems && Array.isArray(items)) {
    data.items = items.map((item) => toPublicInvoiceItem(item));
  }

  return data;
}

module.exports = {
  toDateOnly,
  toMoneyNumber,
  toPublicCustomerSummary,
  toPublicCurrencySummary,
  toPublicInvoice,
  toPublicInvoiceItem,
  toPublicInvoicedBy,
  toPublicPaymentTerm,
};
