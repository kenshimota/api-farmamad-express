const { parsePositiveInteger } = require("../shared/parsers");

/**
 * Parses a payment id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parsePaymentId(value) {
  return parsePositiveInteger(value);
}

module.exports = { parsePaymentId };
