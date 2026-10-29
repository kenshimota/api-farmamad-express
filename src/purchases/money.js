const MAX_MONEY = 9999999999.99;

/**
 * Converts a monetary value to integer cents. Working in cents keeps the
 * subtotal, tax and total exact instead of accumulating binary floating point
 * errors.
 * @param {unknown} value - Numeric value or numeric string with 2 decimals.
 * @returns {number} The value in cents.
 * @throws {TypeError} When the value is not finite.
 */
function toCents(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new TypeError("Invalid money value");
  }

  return Math.round(numeric * 100);
}

/**
 * Tells whether a value has at most two decimal places.
 * @param {number} value - Numeric value already cast by yup.
 * @returns {boolean} True when it fits DECIMAL(12,2) decimals.
 */
function hasAtMostTwoDecimals(value) {
  if (!Number.isFinite(value)) {
    return false;
  }

  const scaled = value * 100;
  const tolerance = Number.EPSILON * Math.abs(scaled) * 4;

  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

/**
 * Formats a decimal value with exactly two decimals for a DECIMAL(12,2)
 * column.
 * @param {unknown} value - Numeric value.
 * @returns {string} The fixed representation, e.g. `837.50`.
 */
function toDecimal(value) {
  return (Math.round(Number(value) * 100) / 100).toFixed(2);
}

/**
 * Calculates the historical subtotal of one purchase line.
 * @param {number} quantity - Positive integer quantity.
 * @param {number|string} unitCost - Unit cost with 2 decimals.
 * @returns {number} `quantity × unit_cost` rounded to 2 decimals.
 */
function calculateLineSubtotal(quantity, unitCost) {
  return (quantity * toCents(unitCost)) / 100;
}

/**
 * Calculates the purchase totals from its lines and tax rate. The tax amount
 * is `round(subtotal × tax_rate / 100, 2)` and the total is the sum of both.
 * @param {object[]} items - Lines with `quantity` and `unit_cost`.
 * @param {number|string} taxRate - Tax rate between 0 and 100.
 * @returns {{ subtotal: number, tax_amount: number, total: number }}
 *   The calculated totals as numbers.
 */
function calculateTotals(items, taxRate) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * toCents(item.unit_cost),
    0,
  );
  const taxRateHundredths = toCents(taxRate);
  const taxCents = Math.round((subtotalCents * taxRateHundredths) / 10000);

  return {
    subtotal: subtotalCents / 100,
    tax_amount: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}

module.exports = {
  MAX_MONEY,
  calculateLineSubtotal,
  calculateTotals,
  hasAtMostTwoDecimals,
  toCents,
  toDecimal,
};
