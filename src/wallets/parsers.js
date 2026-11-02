const { parsePositiveInteger } = require("../shared/parsers");

/**
 * Parses a wallet id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseWalletId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses a customer id coming from a route parameter or query string.
 * @param {unknown} value - Raw value.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseCustomerId(value) {
  return parsePositiveInteger(value);
}

module.exports = { parseCustomerId, parseWalletId };
