const { UniqueConstraintError } = require("sequelize");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  const error = new Error(body.message ?? "Currency error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for a malformed currency id.
 * @returns {Error} The HTTP error.
 */
function invalidCurrencyId() {
  return httpError(422, { errors: { id: "Invalid currency id" } });
}

/**
 * 404 response for an unknown currency.
 * @returns {Error} The HTTP error.
 */
function currencyNotFound() {
  return httpError(404, { message: "Currency not found" });
}

/**
 * 409 response for a duplicated code.
 * @returns {Error} The HTTP error.
 */
function currencyAlreadyExists() {
  return httpError(409, { message: "Currency already exists" });
}

/**
 * 409 response used when a base currency rate is changed.
 * @returns {Error} The HTTP error.
 */
function baseRateLocked() {
  return httpError(409, { message: "Base currency rate cannot be changed" });
}

/**
 * 409 response used when the base currency is deactivated.
 * @returns {Error} The HTTP error.
 */
function baseCannotBeDeactivated() {
  return httpError(409, {
    message: "Base currency cannot be deactivated",
  });
}

/**
 * Sends the status and body carried by an HTTP error.
 * @param {import("express").Response} res - Express response.
 * @param {Error & { status: number, body: object }} error - HTTP error.
 * @returns {import("express").Response} The error response.
 */
function sendHttpError(res, error) {
  return res.status(error.status).json(error.body);
}

/**
 * Translates service and persistence errors into HTTP responses. Errors with a
 * `status` and `body` come from the service layer, a duplicated code answers
 * 409 and any other error is rethrown so the global error handler works.
 * @param {unknown} error - Error thrown by the service or Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleCurrencyError(error, res) {
  if (error && typeof error.status === "number" && error.body) {
    return sendHttpError(res, error);
  }

  if (error instanceof UniqueConstraintError) {
    return sendHttpError(res, currencyAlreadyExists());
  }

  throw error;
}

module.exports = {
  baseCannotBeDeactivated,
  baseRateLocked,
  currencyAlreadyExists,
  currencyNotFound,
  handleCurrencyError,
  httpError,
  invalidCurrencyId,
  sendHttpError,
};
