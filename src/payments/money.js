/**
 * Rounds a money value to two decimals.
 * @param {unknown} value - Raw decimal value.
 * @returns {number} The rounded number.
 */
function toCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

module.exports = { toCents };
