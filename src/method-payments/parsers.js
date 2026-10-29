const { parseBooleanFlag, parsePositiveInteger } = require("../shared/parsers");

/**
 * Parses a method payment id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseMethodPaymentId(value) {
  return parsePositiveInteger(value);
}

module.exports = {
  parseBooleanFlag,
  parseMethodPaymentId,
  parsePositiveInteger,
};
