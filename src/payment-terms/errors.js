const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { isHttpError, sendHttpError } = require("../shared/http-error");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  const error = new Error(body.message ?? "Payment term error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for a malformed payment term id.
 * @returns {Error} The HTTP error.
 */
function invalidPaymentTermId() {
  return httpError(422, {
    errors: { id: "Invalid payment term id" },
  });
}

/**
 * 404 response for an unknown payment term.
 * @returns {Error} The HTTP error.
 */
function paymentTermNotFound() {
  return httpError(404, { message: "Payment term not found" });
}

/**
 * 409 response for a duplicated code.
 * @returns {Error} The HTTP error.
 */
function paymentTermAlreadyExists() {
  return httpError(409, { message: "Payment term already exists" });
}

/**
 * 409 response used when a customer, order or invoice still references it.
 * @returns {Error} The HTTP error.
 */
function paymentTermInUse() {
  return httpError(409, { message: "Payment term is in use" });
}

/**
 * Builds a persistence error handler from the strategies each operation needs.
 * @param {object} [strategies] - Error factories per constraint.
 * @param {() => Error} [strategies.unique] - Duplicated code mapping.
 * @param {() => Error} [strategies.foreignKey] - In-use mapping.
 * @returns {(error: unknown, res: import("express").Response) =>
 *   import("express").Response} The translation middleware body.
 * @throws {unknown} The original error when it cannot be classified.
 */
function createPaymentTermErrorHandler({ unique, foreignKey } = {}) {
  return function handlePaymentTermPersistenceError(error, res) {
    if (isHttpError(error)) {
      return sendHttpError(res, error);
    }

    if (unique && error instanceof UniqueConstraintError) {
      return sendHttpError(res, unique());
    }

    if (foreignKey && error instanceof ForeignKeyConstraintError) {
      return sendHttpError(res, foreignKey());
    }

    throw error;
  };
}

const handlePaymentTermError = createPaymentTermErrorHandler({
  unique: paymentTermAlreadyExists,
});
const handlePaymentTermDeleteError = createPaymentTermErrorHandler({
  foreignKey: paymentTermInUse,
});

module.exports = {
  createPaymentTermErrorHandler,
  handlePaymentTermDeleteError,
  handlePaymentTermError,
  httpError,
  invalidPaymentTermId,
  paymentTermAlreadyExists,
  paymentTermInUse,
  paymentTermNotFound,
};
