const POSITIVE_INTEGER_PATTERN = /^\d+$/;

/**
 * Parses a positive integer id from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The id or null when invalid.
 */
function parsePositiveId(value) {
  if (
    typeof value !== "string" ||
    !POSITIVE_INTEGER_PATTERN.test(value.trim())
  ) {
    return null;
  }

  const parsed = Number(value.trim());

  return parsed >= 1 ? parsed : null;
}

module.exports = { parsePositiveId };
