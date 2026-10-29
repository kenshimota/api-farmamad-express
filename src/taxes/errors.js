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
  const error = new Error(body.message ?? "Tax error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for a malformed tax id.
 * @returns {Error} The HTTP error.
 */
function invalidTaxId() {
  return httpError(422, { errors: { id: "Invalid tax id" } });
}

/**
 * 404 response for an unknown tax.
 * @returns {Error} The HTTP error.
 */
function taxNotFound() {
  return httpError(404, { message: "Tax not found" });
}

/**
 * 409 response for a duplicated code.
 * @returns {Error} The HTTP error.
 */
function taxAlreadyExists() {
  return httpError(409, { message: "Tax already exists" });
}

/**
 * 409 response used when another table still references the tax.
 * @returns {Error} The HTTP error.
 */
function taxInUse() {
  return httpError(409, { message: "Tax is in use" });
}

/**
 * Builds a persistence error handler from the strategies each operation needs.
 * Controlled HTTP errors pass through, each injected Sequelize constraint is
 * translated by its own factory and unknown errors are rethrown so the global
 * handler works. Create/update only map a duplicated code, while delete only
 * maps a foreign key violation, so the strategy keeps their behaviours apart.
 * @param {object} [strategies] - Error factories per persistence constraint.
 * @param {() => Error} [strategies.unique] - Duplicated code mapping.
 * @param {() => Error} [strategies.foreignKey] - Foreign key mapping.
 * @returns {(error: unknown, res: import("express").Response) =>
 *   import("express").Response} The translation middleware body.
 * @throws {unknown} The original error when it cannot be classified.
 */
function createTaxErrorHandler({ unique, foreignKey } = {}) {
  return function handleTaxPersistenceError(error, res) {
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
 * answers 409 and any other error is rethrown for the global handler.
 */
const handleTaxError = createTaxErrorHandler({ unique: taxAlreadyExists });

/**
 * Translates the persistence errors of delete. A foreign key violation means
 * another table still references the tax, so it answers 409.
 */
const handleTaxDeleteError = createTaxErrorHandler({ foreignKey: taxInUse });

module.exports = {
  createTaxErrorHandler,
  handleTaxDeleteError,
  handleTaxError,
  httpError,
  invalidTaxId,
  sendHttpError,
  taxAlreadyExists,
  taxInUse,
  taxNotFound,
};
