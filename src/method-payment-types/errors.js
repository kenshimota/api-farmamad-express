const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { isHttpError, sendHttpError } = require("../shared/http-error");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  const error = new Error(body.message ?? "Method payment type error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for a malformed type id.
 * @returns {Error} The HTTP error.
 */
function invalidMethodPaymentTypeId() {
  return httpError(422, {
    errors: { id: "Invalid payment type id" },
  });
}

/**
 * 404 response for an unknown type.
 * @returns {Error} The HTTP error.
 */
function methodPaymentTypeNotFound() {
  return httpError(404, { message: "Payment type not found" });
}

/**
 * 409 response for a duplicated code.
 * @returns {Error} The HTTP error.
 */
function methodPaymentTypeAlreadyExists() {
  return httpError(409, { message: "Payment type already exists" });
}

/**
 * 409 response used when the type already has concrete payment methods.
 * @returns {Error} The HTTP error.
 */
function methodPaymentTypeHasMethods() {
  return httpError(409, { message: "Payment type has methods" });
}

/**
 * 422 response for a missing, inactive or malformed currency reference.
 * @returns {Error} The HTTP error.
 */
function invalidCurrency() {
  return httpError(422, { errors: { currency_id: "Invalid currency" } });
}

/**
 * Builds a persistence error handler from the strategies each operation needs.
 * Controlled HTTP errors pass through, each injected Sequelize constraint is
 * translated by its own factory and unknown errors are rethrown so the global
 * handler works.
 * @param {object} [strategies] - Error factories per persistence constraint.
 * @param {() => Error} [strategies.unique] - Duplicated code mapping.
 * @param {() => Error} [strategies.foreignKey] - Foreign key mapping.
 * @returns {(error: unknown, res: import("express").Response) =>
 *   import("express").Response} The translation middleware body.
 * @throws {unknown} The original error when it cannot be classified.
 */
function createMethodPaymentTypeErrorHandler({ unique, foreignKey } = {}) {
  return function handleMethodPaymentTypePersistenceError(error, res) {
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

/**
 * Translates the persistence errors of create and update. A duplicated code
 * answers 409 and a foreign key violation answers 422 Invalid currency.
 */
const handleMethodPaymentTypeError = createMethodPaymentTypeErrorHandler({
  unique: methodPaymentTypeAlreadyExists,
  foreignKey: invalidCurrency,
});

/**
 * Translates the persistence errors of delete. A foreign key violation means
 * concrete methods still reference the type, so it answers 409.
 */
const handleMethodPaymentTypeDeleteError = createMethodPaymentTypeErrorHandler({
  foreignKey: methodPaymentTypeHasMethods,
});

module.exports = {
  createMethodPaymentTypeErrorHandler,
  handleMethodPaymentTypeDeleteError,
  handleMethodPaymentTypeError,
  httpError,
  invalidCurrency,
  invalidMethodPaymentTypeId,
  methodPaymentTypeAlreadyExists,
  methodPaymentTypeHasMethods,
  methodPaymentTypeNotFound,
  sendHttpError,
};
