const { round2 } = require("../invoice-payments/calculations");

/**
 * Rounds a value to six decimals, matching `currencies.rate` and
 * `exchange_rate DECIMAL(18,6)`.
 * @param {unknown} value - Raw value.
 * @returns {number} The rounded value or NaN when it is not numeric.
 */
function round6(value) {
  return Number(Number(value).toFixed(6));
}

/**
 * Calculates how many target currency units one source unit is worth.
 * @param {unknown} sourceRate - Source currency rate in the base currency.
 * @param {unknown} targetRate - Target currency rate in the base currency.
 * @returns {number} The positive exchange rate or 0 when it is invalid.
 */
function calculateRate(sourceRate, targetRate) {
  const rate = Number(sourceRate) / Number(targetRate);

  return Number.isFinite(rate) && rate > 0 ? round6(rate) : 0;
}

/**
 * Converts an amount with the exchange rate and rounds it to two decimals.
 * @param {unknown} value - Amount in the source currency.
 * @param {unknown} exchangeRate - Target units per source unit.
 * @returns {number} The amount in the target currency.
 */
function convertAmount(value, exchangeRate) {
  return round2(Number(value) * Number(exchangeRate));
}

module.exports = { calculateRate, convertAmount, round2, round6 };
