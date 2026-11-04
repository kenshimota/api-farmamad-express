const { round2, toCents } = require("../purchases/money");
const { readField } = require("./serializer");

/**
 * Calculates the tax amount of a pre-tax subtotal using a percentage rate.
 * The calculation runs in integer cents and supports rates with two decimals.
 * @param {unknown} subtotal - Pre-tax amount.
 * @param {unknown} rate - Percentage rate, e.g. `16` for 16 %.
 * @returns {number} The tax amount rounded to two decimals.
 */
function calculateTaxAmount(subtotal, rate) {
  const subtotalCents = toCents(subtotal);
  const basisPoints = Math.round(Number(rate) * 100);

  if (!Number.isFinite(basisPoints) || basisPoints < 0) {
    return 0;
  }

  return Math.round((subtotalCents * basisPoints) / 10000) / 100;
}

/**
 * Calculates the subtotal, tax and total of one line.
 * @param {object} line - Line values.
 * @param {number} line.quantity - Positive quantity.
 * @param {number|string} line.unit_price - Pre-tax unit price.
 * @param {number|string} [line.tax_rate] - Percentage rate.
 * @returns {{ subtotal: number, tax_amount: number, total: number }} Amounts.
 */
function calculateLineAmounts({
  quantity,
  unit_price: unitPrice,
  tax_rate: rate = 0,
}) {
  const subtotal = (Number(quantity) * toCents(unitPrice)) / 100;
  const taxAmount = calculateTaxAmount(subtotal, rate);

  return {
    subtotal: round2(subtotal),
    tax_amount: round2(taxAmount),
    total: round2((toCents(subtotal) + toCents(taxAmount)) / 100),
  };
}

/**
 * Sums the subtotal, tax and total of the given lines.
 * @param {object[]} lines - Lines with `subtotal`, `tax_amount` and `total`.
 * @returns {{ subtotal: number, tax_amount: number, total: number }} Totals.
 */
function sumLineAmounts(lines) {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + toCents(line.subtotal ?? 0),
    0,
  );
  const taxCents = lines.reduce(
    (sum, line) => sum + toCents(line.tax_amount ?? 0),
    0,
  );

  return {
    subtotal: round2(subtotalCents / 100),
    tax_amount: round2(taxCents / 100),
    total: round2((subtotalCents + taxCents) / 100),
  };
}

/**
 * Builds the tax snapshot stored in an order or invoice line.
 * @param {object|null|undefined} tax - Tax instance or plain object.
 * @returns {{ tax_id: number|null, tax_code: string|null,
 *   tax_name: string|null, tax_rate: number }} Snapshot values.
 */
function toTaxSnapshot(tax) {
  if (!tax) {
    return { tax_id: null, tax_code: null, tax_name: null, tax_rate: 0 };
  }

  return {
    tax_id: readField(tax, "id"),
    tax_code: readField(tax, "code"),
    tax_name: readField(tax, "name"),
    tax_rate: round2(readField(tax, "rate") ?? 0),
  };
}

module.exports = {
  calculateLineAmounts,
  calculateTaxAmount,
  sumLineAmounts,
  toTaxSnapshot,
};
