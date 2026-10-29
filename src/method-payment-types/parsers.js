const POSITIVE_INTEGER_PATTERN = /^\d+$/;

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
 * Parses a method payment type id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseMethodPaymentTypeId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses a boolean query flag. Only `true` and `false` (also as strings) are
 * accepted; anything else resolves to undefined so the caller can answer 422.
 * @param {unknown} value - Raw query value.
 * @returns {boolean|undefined} The parsed flag or undefined when invalid.
 */
function parseBooleanFlag(value) {
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

module.exports = {
  parseBooleanFlag,
  parseMethodPaymentTypeId,
  parsePositiveInteger,
};
