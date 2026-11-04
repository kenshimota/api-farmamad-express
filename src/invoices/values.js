const { calculateTaxAmount, sumLineAmounts } = require("../shared/tax");

const STATUS_PENDING = "pending";

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
 * Normalizes the line snapshots and calculates their tax and totals.
 * @param {object[]} items - Requested line snapshots.
 * @returns {object[]} Normalized lines.
 */
function normalizeItems(items) {
  return items.map((item) => {
    const unitPrice = round2(item.unit_price);
    const subtotal =
      item.subtotal === undefined
        ? calculateItemSubtotal({ ...item, unit_price: unitPrice })
        : round2(item.subtotal);
    const taxRate = round2(item.tax_rate ?? 0);
    const taxAmount = calculateTaxAmount(subtotal, taxRate);

    return {
      ...item,
      unit_price: unitPrice,
      subtotal,
      tax_id: item.tax_id ?? null,
      tax_code: item.tax_code ?? null,
      tax_name: item.tax_name ?? null,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: round2(subtotal + taxAmount),
    };
  });
}

/**
 * Resolves the invoice header totals from its snapshot and normalized lines.
 * Missing values come from the lines; a tax amount that differs from the line
 * sum is recalculated so the header always matches its lines.
 * @param {object} input - Validated invoice snapshot.
 * @param {object[]} items - Normalized lines.
 * @returns {{ subtotal: number, taxAmount: number, total: number }} Totals.
 */
function resolveInvoiceTotals(input, items) {
  const itemTotals = sumLineAmounts(items);
  const subtotal =
    input.subtotal === undefined ? itemTotals.subtotal : round2(input.subtotal);
  const taxMismatch =
    input.tax_amount !== undefined &&
    round2(input.tax_amount) !== itemTotals.tax_amount;
  const taxAmount =
    items.length > 0 && (input.tax_amount === undefined || taxMismatch)
      ? itemTotals.tax_amount
      : round2(input.tax_amount ?? 0);
  const total =
    input.total === undefined || taxMismatch
      ? round2(subtotal + taxAmount)
      : round2(input.total);

  return { subtotal, taxAmount, total };
}

/**
 * Builds the persisted invoice header from the order snapshot.
 * @param {object} input - Validated invoice snapshot.
 * @param {object} context - Calculated context.
 * @param {number} context.number - Sequence number.
 * @param {Date} context.issuedAt - Issue instant.
 * @param {number} context.subtotal - Invoice subtotal.
 * @param {number} context.taxAmount - Invoice tax amount.
 * @param {number} context.total - Invoice total.
 * @param {number} context.paymentTermDays - Snapshot days of the term.
 * @returns {object} Invoice attribute values.
 */
function buildInvoiceValues(
  input,
  { number, issuedAt, subtotal, taxAmount, total, paymentTermDays },
) {
  return {
    number,
    order_id: input.order_id ?? null,
    customer_id: input.customer_id,
    invoiced_by_user_id: input.invoiced_by_user_id,
    currency_id: input.currency_id,
    payment_term_id: input.payment_term_id,
    subtotal,
    tax_amount: taxAmount,
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
  buildInvoiceValues,
  calculateDueDate,
  calculateItemSubtotal,
  normalizeItems,
  resolveInvoiceTotals,
  round2,
  sumLineAmounts,
};
