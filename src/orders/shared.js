const { isHttpError, sendHttpError } = require("../shared/http-error");

/**
 * Translates service errors into HTTP responses. Controlled errors pass
 * through; any other error is rethrown so the global handler keeps working.
 * @param {unknown} error - Error thrown by the service.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleOrderError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  throw error;
}

module.exports = { handleOrderError };
