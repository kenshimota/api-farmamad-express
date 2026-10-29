const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");

/**
 * Tells whether an error carries the HTTP status and body built by the service
 * layer, so routers can answer it without a database-specific translation.
 * @param {unknown} error - Error thrown by a service.
 * @returns {boolean} True when the error is an HTTP error.
 */
function isHttpError(error) {
  return (
    Boolean(error) && typeof error.status === "number" && Boolean(error.body)
  );
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
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @param {string} [fallbackMessage] - Message used when the body has none.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function createHttpError(status, body, fallbackMessage = "Request error") {
  const error = new Error(body.message ?? fallbackMessage);

  error.status = status;
  error.body = body;

  return error;
}

/**
 * Builds a persistence error handler from the strategies each operation needs.
 * Controlled HTTP errors pass through, each injected Sequelize constraint is
 * translated by its own factory and unknown errors are rethrown so the global
 * handler works.
 * @param {object} [strategies] - Error factories per persistence constraint.
 * @param {() => Error} [strategies.unique] - Unique constraint mapping.
 * @param {() => Error} [strategies.foreignKey] - Foreign key mapping.
 * @returns {(error: unknown, res: import("express").Response) =>
 *   import("express").Response} The translation middleware body.
 * @throws {unknown} The original error when it cannot be classified.
 */
function createPersistenceErrorHandler({ unique, foreignKey } = {}) {
  return function handlePersistenceError(error, res) {
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

module.exports = {
  createHttpError,
  createPersistenceErrorHandler,
  isHttpError,
  sendHttpError,
};
