const { round2, toCents, toDecimal } = require("../purchases/money");
const {
  calculateLineAmounts,
  sumLineAmounts,
} = require("../shared/tax");

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
 * Calculates the totals of an order from its lines, including tax.
 * @param {Array<{ quantity: number, unit_price: number|string,
 *   tax_rate?: number|string }>} lines - Priced lines.
 * @returns {{ subtotal: number, tax_amount: number, total: number }} Totals.
 */
function calculateOrderTotals(lines) {
  const amounts = lines.map((line) =>
    calculateLineAmounts({
      quantity: line.quantity,
      unit_price: line.unit_price,
      tax_rate: line.tax_rate ?? 0,
    }),
  );

  return sumLineAmounts(amounts);
}

/**
 * Formats the persisted monetary and tax attributes of an order line.
 * @param {object} line - Priced line.
 * @param {number} line.quantity - Positive integer quantity.
 * @param {number|string} line.unit_price - Unit price in the order currency.
 * @param {number|string} [line.tax_rate] - Percentage tax rate.
 * @param {number|null} [line.tax_id] - Tax catalog id snapshot.
 * @param {string|null} [line.tax_code] - Tax code snapshot.
 * @param {string|null} [line.tax_name] - Tax name snapshot.
 * @returns {object} Values for the DECIMAL and snapshot columns.
 */
function toLineAmounts({
  quantity,
  unit_price: unitPrice,
  tax_rate: taxRate = 0,
  tax_id: taxId = null,
  tax_code: taxCode = null,
  tax_name: taxName = null,
}) {
  const amounts = calculateLineAmounts({
    quantity,
    unit_price: unitPrice,
    tax_rate: taxRate,
  });

  return {
    unit_price: toDecimal(unitPrice),
    subtotal: toDecimal(amounts.subtotal),
    tax_id: taxId,
    tax_code: taxCode,
    tax_name: taxName,
    tax_rate: toDecimal(taxRate),
    tax_amount: toDecimal(amounts.tax_amount),
    total: toDecimal(amounts.total),
  };
}

/**
 * Formats the calculated order totals for the header.
 * @param {{ subtotal: number, tax_amount: number, total: number }} totals -
 *   Calculated totals.
 * @returns {{ subtotal: string, tax_amount: string, total: string }} Values
 *   ready for DECIMAL(12,2) columns.
 */
function toOrderAmounts({ subtotal, tax_amount: taxAmount, total }) {
  return {
    subtotal: toDecimal(subtotal),
    tax_amount: toDecimal(taxAmount),
    total: toDecimal(total),
  };
}

module.exports = {
  calculateLineSubtotal,
  calculateOrderTotals,
  round2,
  toLineAmounts,
  toOrderAmounts,
};
