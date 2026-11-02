const { parseBooleanFlag, parsePositiveInteger } = require("../shared/parsers");

const MAX_NUMBER_LENGTH = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCATION_STATUSES = Object.freeze(["pending", "in_progress", "located"]);

/**
 * Tells whether a `YYYY-MM-DD` value is a real calendar date, rejecting values
 * such as `2026-02-30`.
 * @param {string} value - Date already checked against the format.
 * @returns {boolean} True when the calendar date exists.
 */
function isCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/**
 * Parses a lot id from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseLotId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `number` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} The trimmed number or null when invalid.
 */
function parseNumberFilter(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length >= 1 && trimmed.length <= MAX_NUMBER_LENGTH
    ? trimmed
    : null;
}

/**
 * Parses the optional `expired` listing flag. Only the literal true/false
 * values (also as strings) are accepted; any other value is invalid.
 * @type {(value: unknown) => boolean|undefined}
 */
const parseExpired = parseBooleanFlag;

/**
 * Parses the optional `expiring_before` date filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} The normalized date or null when invalid.
 */
function parseExpiringBefore(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return DATE_PATTERN.test(trimmed) && isCalendarDate(trimmed) ? trimmed : null;
}

/**
 * Parses the optional `location_status` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} One of the three statuses or null when invalid.
 */
function parseLocationStatus(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return LOCATION_STATUSES.includes(trimmed) ? trimmed : null;
}

module.exports = {
  DATE_PATTERN,
  LOCATION_STATUSES,
  MAX_NUMBER_LENGTH,
  isCalendarDate,
  parseExpired,
  parseExpiringBefore,
  parseLocationStatus,
  parseLotId,
  parseNumberFilter,
  parsePositiveInteger,
};
