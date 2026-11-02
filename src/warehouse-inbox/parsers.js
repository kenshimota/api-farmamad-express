const {
  parseExpiringBefore,
  parseNumberFilter,
  parsePositiveInteger,
} = require("../lots/parsers");
const { STATUSES } = require("./validators");

/**
 * Parses a lot id.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The id or null.
 */
function parseLotId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional status filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} One of pending, in_progress, located, all or null.
 */
function parseStatus(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return STATUSES.includes(trimmed) ? trimmed : null;
}

/**
 * Parses an optional lot number filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} The trimmed number or null.
 */
function parseLotNumber(value) {
  return parseNumberFilter(value);
}

module.exports = {
  parseExpiringBefore,
  parseLotId,
  parseLotNumber,
  parsePositiveInteger,
  parseStatus,
};
