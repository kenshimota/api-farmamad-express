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
 * Calculates the total of one line from its stored subtotal and tax amount.
 * @param {number|string} subtotal - Pre-tax line subtotal.
 * @param {number|string} taxAmount - Absolute line tax.
 * @returns {number} `subtotal + tax_amount` calculated in cents.
 */
function calculateLineTotal(subtotal, taxAmount) {
  return (toCents(subtotal) + toCents(taxAmount)) / 100;
}

/**
 * Builds the persisted monetary attributes of a purchase line. The subtotal is
 * always derived from `quantity × unit_cost` and a missing tax means zero, so
 * every caller stores lines the same way.
 * @param {object} line - Line values.
 * @param {number} line.quantity - Positive integer quantity.
 * @param {number|string} line.unit_cost - Unit cost with 2 decimals.
 * @param {number|string} [line.tax_amount] - Absolute line tax.
 * @returns {{ unit_cost: string, subtotal: string, tax_amount: string }}
 *   The values ready for the DECIMAL(12,2) columns.
 */
function toLineAmounts({ quantity, unit_cost, tax_amount = 0 }) {
  return {
    unit_cost: toDecimal(unit_cost),
    subtotal: toDecimal(calculateLineSubtotal(quantity, unit_cost)),
    tax_amount: toDecimal(tax_amount),
  };
}

/**
 * Formats the calculated purchase totals for the DECIMAL(12,2) columns.
 * @param {{ subtotal: number, tax_amount: number, total: number }} totals -
 *   Totals returned by `calculateTotals`.
 * @returns {{ subtotal: string, tax_amount: string, total: string }} The
 *   values ready for the header columns.
 */
function toTotalsAmounts({ subtotal, tax_amount, total }) {
  return {
    subtotal: toDecimal(subtotal),
    tax_amount: toDecimal(tax_amount),
    total: toDecimal(total),
  };
}

/**
 * Calculates the purchase totals from its lines. The subtotal is the sum of
 * `quantity × unit_cost`, the tax amount is the sum of the line taxes and the
 * total is the sum of both. Every step works in integer cents.
 * @param {object[]} items - Lines with `quantity`, `unit_cost` and `tax_amount`.
 * @returns {{ subtotal: number, tax_amount: number, total: number }}
 *   The calculated totals as numbers.
 */
function calculateTotals(items) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * toCents(item.unit_cost),
    0,
  );
  const taxCents = items.reduce(
    (sum, item) => sum + toCents(item.tax_amount ?? 0),
    0,
  );

  return {
    subtotal: subtotalCents / 100,
    tax_amount: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}

module.exports = {
  MAX_MONEY,
  calculateLineSubtotal,
  calculateLineTotal,
  calculateTotals,
  hasAtMostTwoDecimals,
  toCents,
  toDecimal,
  toLineAmounts,
  toTotalsAmounts,
};
