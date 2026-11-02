const { round2, toCents, toDecimal } = require("../purchases/money");

/**
 * Calculates the historical subtotal of one order line.
 * @param {number} quantity - Positive integer quantity.
 * @param {number|string} unitPrice - Unit price with 2 decimals.
 * @returns {number} `quantity × unit_price` rounded to 2 decimals.
 */
function calculateLineSubtotal(quantity, unitPrice) {
  return (quantity * toCents(unitPrice)) / 100;
}

/**
 * Adds the order lines in integer cents. In this HU the total equals the
 * subtotal because there are no taxes, discounts or shipping.
 * @param {Array<{ quantity: number, unit_price: number|string }>} lines -
 *   Priced lines.
 * @returns {{ subtotal: number, total: number }} The calculated totals.
 */
function calculateOrderTotals(lines) {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.quantity * toCents(line.unit_price),
    0,
  );
  const subtotal = round2(subtotalCents / 100);

  return { subtotal, total: subtotal };
}

/**
 * Formats the persisted monetary attributes of an order line.
 * @param {object} line - Priced line.
 * @param {number} line.quantity - Positive integer quantity.
 * @param {number|string} line.unit_price - Unit price in the order currency.
 * @returns {{ unit_price: string, subtotal: string }} Values for
 *   DECIMAL(12,2) columns.
 */
function toLineAmounts({ quantity, unit_price: unitPrice }) {
  return {
    unit_price: toDecimal(unitPrice),
    subtotal: toDecimal(calculateLineSubtotal(quantity, unitPrice)),
  };
}

/**
 * Formats the calculated order totals for DECIMAL(12,2) columns.
 * @param {{ subtotal: number, total: number }} totals - Calculated totals.
 * @returns {{ subtotal: string, total: string }} Values for the header.
 */
function toOrderAmounts({ subtotal, total }) {
  return {
    subtotal: toDecimal(subtotal),
    total: toDecimal(total),
  };
}

module.exports = {
  calculateLineSubtotal,
  calculateOrderTotals,
  toLineAmounts,
  toOrderAmounts,
};
