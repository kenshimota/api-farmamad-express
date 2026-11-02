const { isHttpError, sendHttpError } = require("../shared/http-error");

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

/**
 * Translates controlled service errors into responses; unknown errors are
 * rethrown so the global handler keeps working.
 * @param {unknown} error - Error thrown by the service.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleOrderStatusError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  throw error;
}

module.exports = { handleOrderStatusError, parsePositiveId };
