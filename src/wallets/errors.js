const { createHttpError } = require("../shared/http-error");

/**
 * Builds an error that carries the HTTP status and body the wallet router must
 * send.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  return createHttpError(status, body, "Wallet error");
}

/**
 * 422 response for a malformed wallet id.
 * @returns {Error} The HTTP error.
 */
function invalidWalletId() {
  return httpError(422, { errors: { id: "Invalid wallet id" } });
}

/**
 * 422 response for a malformed customer id filter.
 * @returns {Error} The HTTP error.
 */
function invalidCustomerId() {
  return httpError(422, {
    errors: { customer_id: "Invalid customer_id" },
  });
}

/**
 * 404 response for an unknown wallet.
 * @returns {Error} The HTTP error.
 */
function walletNotFound() {
  return httpError(404, { message: "Wallet not found" });
}

module.exports = {
  httpError,
  invalidCustomerId,
  invalidWalletId,
  walletNotFound,
};
