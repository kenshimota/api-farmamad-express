const STATUS_PENDING = "pending";
const TAX_AMOUNT = 0;

/**
 * Rounds a numeric amount to two decimals.
 * @param {unknown} value - Raw amount.
 * @returns {number} The rounded amount or 0 when invalid.
 */
function round2(value) {
  const number = Number(value);

  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

/**
 * Calculates a line subtotal as `quantity × unit_price`.
 * @param {object} item - Line with quantity and unit_price.
 * @returns {number} The rounded subtotal.
 */
function calculateItemSubtotal(item) {
  return round2(Number(item.quantity) * Number(item.unit_price));
}

/**
 * Calculates `issued_at + payment_terms.days` as a `YYYY-MM-DD` date.
 * Invalid or missing days mean cash, so the issue date is returned.
 * @param {Date|string} issuedAt - Invoice issue instant.
 * @param {unknown} days - Payment term days.
 * @returns {string} The due date without time.
 */
function calculateDueDate(issuedAt, days) {
  const parsed = new Date(issuedAt);
  const amount = Number.isInteger(days) && days >= 0 ? days : 0;
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const date = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + amount,
    ),
  );

  return date.toISOString().slice(0, 10);
}

/**
 * Normalizes the line snapshots and calculates their subtotals.
 * @param {object[]} items - Requested line snapshots.
 * @returns {object[]} Normalized lines.
 */
function normalizeItems(items) {
  return items.map((item) => ({
    ...item,
    unit_price: round2(item.unit_price),
    subtotal:
      item.subtotal === undefined
        ? calculateItemSubtotal(item)
        : round2(item.subtotal),
  }));
}

/**
 * Builds the persisted invoice header from the order snapshot.
 * @param {object} input - Validated invoice snapshot.
 * @param {object} context - Calculated context.
 * @param {number} context.number - Sequence number.
 * @param {Date} context.issuedAt - Issue instant.
 * @param {number} context.subtotal - Invoice subtotal.
 * @param {number} context.total - Invoice total.
 * @param {number} context.paymentTermDays - Snapshot days of the term.
 * @returns {object} Invoice attribute values.
 */
function buildInvoiceValues(
  input,
  { number, issuedAt, subtotal, total, paymentTermDays },
) {
  return {
    number,
    order_id: input.order_id ?? null,
    customer_id: input.customer_id,
    invoiced_by_user_id: input.invoiced_by_user_id,
    currency_id: input.currency_id,
    payment_term_id: input.payment_term_id,
    subtotal,
    tax_amount: TAX_AMOUNT,
    total,
    paid_amount: 0,
    payment_status: STATUS_PENDING,
    issued_at: issuedAt,
    due_date:
      input.due_date ?? calculateDueDate(issuedAt, paymentTermDays ?? 0),
    notes: input.notes ?? null,
  };
}

module.exports = {
  STATUS_PENDING,
  TAX_AMOUNT,
  buildInvoiceValues,
  calculateDueDate,
  calculateItemSubtotal,
  normalizeItems,
  round2,
};
