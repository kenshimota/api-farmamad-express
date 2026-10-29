const MAX_NUMBER_LENGTH = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

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
 * Parses a positive integer identifier coming from a route or query.
 * @param {unknown} value - Raw value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parsePositiveInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return parsed >= 1 ? parsed : null;
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
 * values (also as strings) are accepted.
 * @param {unknown} value - Raw query value.
 * @returns {boolean|undefined} The parsed flag or undefined when invalid.
 */
function parseExpired(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return undefined;
}

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

module.exports = {
  DATE_PATTERN,
  MAX_NUMBER_LENGTH,
  isCalendarDate,
  parseExpired,
  parseExpiringBefore,
  parseLotId,
  parseNumberFilter,
  parsePositiveInteger,
};
