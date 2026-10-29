const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  const error = new Error(body.message ?? "Shelf error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for an invalid shelf id.
 * @returns {Error} The HTTP error.
 */
function invalidShelfId() {
  return httpError(422, { errors: { id: "Invalid shelf id" } });
}

/**
 * 422 response for an invalid shelf id in a nested route or filter.
 * @returns {Error} The HTTP error.
 */
function invalidRouteShelfId() {
  return httpError(422, { errors: { shelf_id: "Invalid shelf id" } });
}

/**
 * 422 response for an invalid section id.
 * @returns {Error} The HTTP error.
 */
function invalidSectionId() {
  return httpError(422, { errors: { section_id: "Invalid section id" } });
}

/**
 * 422 response for an unknown warehouse reference.
 * @returns {Error} The HTTP error.
 */
function invalidWarehouseId() {
  return httpError(422, {
    errors: { warehouse_id: "Invalid warehouse id" },
  });
}

/**
 * 404 response for an unknown shelf.
 * @returns {Error} The HTTP error.
 */
function shelfNotFound() {
  return httpError(404, { message: "Shelf not found" });
}

/**
 * 404 response for an unknown section or a section owned by another shelf.
 * @returns {Error} The HTTP error.
 */
function sectionNotFound() {
  return httpError(404, { message: "Section not found" });
}

/**
 * 409 response for a duplicated shelf code inside its warehouse.
 * @returns {Error} The HTTP error.
 */
function shelfAlreadyExists() {
  return httpError(409, { message: "Shelf already exists" });
}

/**
 * 409 response for a duplicated section code inside its shelf.
 * @returns {Error} The HTTP error.
 */
function sectionAlreadyExists() {
  return httpError(409, { message: "Section already exists" });
}

/**
 * 409 response used when lots still reference a shelf.
 * @returns {Error} The HTTP error.
 */
function shelfHasLots() {
  return httpError(409, { message: "Shelf has lots" });
}

/**
 * 409 response used when lots still reference a section.
 * @returns {Error} The HTTP error.
 */
function sectionHasLots() {
  return httpError(409, { message: "Section has lots" });
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
 * Tells whether the error is one of the controlled HTTP errors.
 * @param {unknown} error - Candidate error.
 * @returns {boolean} True when it carries a status and a body.
 */
function isHttpError(error) {
  return Boolean(error && typeof error.status === "number" && error.body);
}

/**
 * Builds a persistence error handler from the strategy that each operation
 * needs. Sequelize errors are mapped to the HTTP error factory injected for
 * that constraint, and unknown errors are rethrown for the global handler.
 * @param {object} strategies - Error factories for the Sequelize constraints.
 * @param {() => Error} [strategies.unique] - Duplicated code mapping.
 * @param {() => Error} [strategies.foreignKey] - Broken reference mapping.
 * @returns {(error: unknown, res: import("express").Response) =>
 *   import("express").Response} The translation middleware body.
 * @throws {unknown} The original error when it cannot be classified.
 */
function createPersistenceErrorHandler({ unique, foreignKey }) {
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

/**
 * Translates shelf create and update persistence errors. A duplicated code
 * answers 409 and a broken warehouse reference answers 422.
 */
const handleShelfWriteError = createPersistenceErrorHandler({
  unique: shelfAlreadyExists,
  foreignKey: invalidWarehouseId,
});

/**
 * Translates shelf delete persistence errors. A foreign key violation means
 * lots still reference the shelf, so it answers 409.
 */
const handleShelfDeleteError = createPersistenceErrorHandler({
  foreignKey: shelfHasLots,
});

/**
 * Translates section create and update persistence errors. A duplicated code
 * answers 409.
 */
const handleSectionWriteError = createPersistenceErrorHandler({
  unique: sectionAlreadyExists,
  foreignKey: invalidRouteShelfId,
});

/**
 * Translates section delete persistence errors. A foreign key violation means
 * lots still reference the section, so it answers 409.
 */
const handleSectionDeleteError = createPersistenceErrorHandler({
  foreignKey: sectionHasLots,
});

module.exports = {
  handleSectionDeleteError,
  handleSectionWriteError,
  handleShelfDeleteError,
  handleShelfWriteError,
  httpError,
  invalidRouteShelfId,
  invalidSectionId,
  invalidShelfId,
  invalidWarehouseId,
  isHttpError,
  sectionAlreadyExists,
  sectionHasLots,
  sectionNotFound,
  sendHttpError,
  shelfAlreadyExists,
  shelfHasLots,
  shelfNotFound,
};
