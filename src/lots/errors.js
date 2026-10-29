const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const {
  ITEM_STATE_ID_MESSAGE,
  PRODUCT_ID_MESSAGE,
  SECTION_ID_MESSAGE,
  SHELF_ID_MESSAGE,
  WAREHOUSE_ID_MESSAGE,
} = require("./validators");

const FOREIGN_KEY_FIELDS = Object.freeze([
  "product_id",
  "item_state_id",
  "warehouse_id",
  "shelf_id",
  "section_id",
]);
const FOREIGN_KEY_MESSAGES = Object.freeze({
  product_id: PRODUCT_ID_MESSAGE,
  item_state_id: ITEM_STATE_ID_MESSAGE,
  warehouse_id: WAREHOUSE_ID_MESSAGE,
  shelf_id: SHELF_ID_MESSAGE,
  section_id: SECTION_ID_MESSAGE,
});

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  const error = new Error(body.message ?? "Lot error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for an invalid lot id.
 * @returns {Error} The HTTP error.
 */
function invalidLotId() {
  return httpError(422, { errors: { id: "Invalid lot id" } });
}

/**
 * 404 response for an unknown lot.
 * @returns {Error} The HTTP error.
 */
function lotNotFound() {
  return httpError(404, { message: "Lot not found" });
}

/**
 * 409 response for a duplicated `(product_id, number)`.
 * @returns {Error} The HTTP error.
 */
function lotAlreadyExists() {
  return httpError(409, { message: "Lot already exists" });
}

/**
 * 409 response used when a lot still has stock or reservations.
 * @returns {Error} The HTTP error.
 */
function lotHasStock() {
  return httpError(409, { message: "Lot has stock or reservations" });
}

/**
 * Builds a 422 response for an unknown reference.
 * @param {string} field - Foreign key field name.
 * @returns {Error} The HTTP error.
 */
function invalidReference(field) {
  return httpError(422, {
    errors: { [field]: FOREIGN_KEY_MESSAGES[field] },
  });
}

/**
 * 422 response for a shelf that belongs to another warehouse.
 * @returns {Error} The HTTP error.
 */
function shelfWarehouseMismatch() {
  return httpError(422, {
    errors: { shelf_id: "Shelf does not belong to the warehouse" },
  });
}

/**
 * 422 response for a section that belongs to another shelf.
 * @returns {Error} The HTTP error.
 */
function sectionShelfMismatch() {
  return httpError(422, {
    errors: { section_id: "Section does not belong to the shelf" },
  });
}

/**
 * 422 response for `reserved > stock`.
 * @returns {Error} The HTTP error.
 */
function reservedExceedsStock() {
  return httpError(422, {
    errors: { reserved: "reserved cannot exceed stock" },
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
 * Tells whether the error is one of the controlled HTTP errors.
 * @param {unknown} error - Candidate error.
 * @returns {boolean} True when it carries a status and a body.
 */
function isHttpError(error) {
  return Boolean(error && typeof error.status === "number" && error.body);
}

/**
 * Reads the foreign key field named by a Sequelize constraint error.
 * @param {ForeignKeyConstraintError} error - Sequelize constraint error.
 * @returns {string|null} The matching field name or null.
 */
function foreignKeyField(error) {
  const fields = error.fields;
  const candidates = Array.isArray(fields) ? fields : Object.keys(fields ?? {});
  const direct = candidates.find((field) => FOREIGN_KEY_FIELDS.includes(field));

  if (direct) {
    return direct;
  }

  const message = `${error.message ?? ""} ${
    error.parent?.detail ?? ""
  }`.toLowerCase();

  return FOREIGN_KEY_FIELDS.find((field) => message.includes(field)) ?? null;
}

/**
 * Builds a persistence error handler from the strategy each operation needs.
 * Sequelize errors are mapped by the injected factories, controlled HTTP
 * errors pass through and unknown errors are rethrown for the global handler.
 * @param {object} strategies - Error factories for the Sequelize constraints.
 * @param {() => Error} [strategies.unique] - Duplicated pair mapping.
 * @param {(error: ForeignKeyConstraintError) => Error|null} [strategies.foreignKey]
 *   Broken reference mapping; null lets the error be rethrown.
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
      const mapped = foreignKey(error);

      if (mapped) {
        return sendHttpError(res, mapped);
      }
    }

    throw error;
  };
}

/**
 * Translates the persistence errors of create and update into HTTP responses.
 * A duplicated pair answers 409 and a broken reference answers 422 for the
 * affected field.
 */
const handleWriteError = createPersistenceErrorHandler({
  unique: lotAlreadyExists,
  foreignKey(error) {
    const field = foreignKeyField(error);

    return field ? invalidReference(field) : null;
  },
});

/**
 * Translates delete persistence errors. Future rows that reference a lot are
 * reported as a 409 without leaking the driver error.
 */
const handleDeleteError = createPersistenceErrorHandler({
  foreignKey: () => httpError(409, { message: "Lot is in use" }),
});

module.exports = {
  FOREIGN_KEY_MESSAGES,
  createPersistenceErrorHandler,
  handleDeleteError,
  handleWriteError,
  httpError,
  invalidLotId,
  invalidReference,
  isHttpError,
  lotAlreadyExists,
  lotHasStock,
  lotNotFound,
  reservedExceedsStock,
  sectionShelfMismatch,
  sendHttpError,
  shelfWarehouseMismatch,
};
