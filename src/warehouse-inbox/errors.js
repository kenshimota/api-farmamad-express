const {
  createHttpError,
  isHttpError,
  sendHttpError,
} = require("../shared/http-error");

/**
 * Builds an error carrying the HTTP status and body the router must send.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  return createHttpError(status, body, "Warehouse inbox error");
}

/**
 * 404 response for an unknown lot.
 * @returns {Error} The HTTP error.
 */
function lotNotFound() {
  return httpError(404, { message: "Lot not found" });
}

/**
 * 409 response when another user already started locating the lot.
 * @returns {Error} The HTTP error.
 */
function beingLocatedByAnotherUser() {
  return httpError(409, {
    message: "Lot is being located by another user",
  });
}

/**
 * 409 response when the lot is already located.
 * @returns {Error} The HTTP error.
 */
function alreadyLocated() {
  return httpError(409, { message: "Lot is already located" });
}

/**
 * 422 response for a missing reference.
 * @param {string} field - `warehouse_id`, `shelf_id` or `section_id`.
 * @returns {Error} The HTTP error.
 */
function invalidReference(field) {
  const labels = {
    warehouse_id: "Invalid warehouse id",
    shelf_id: "Invalid shelf id",
    section_id: "Invalid section id",
  };

  return httpError(422, { errors: { [field]: labels[field] } });
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
 * Translates service errors into HTTP responses; unknown errors are rethrown
 * so the global handler keeps working.
 * @param {unknown} error - Thrown error.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it is not controlled.
 */
function handleInboxError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  throw error;
}

module.exports = {
  alreadyLocated,
  beingLocatedByAnotherUser,
  handleInboxError,
  httpError,
  invalidReference,
  lotNotFound,
  sectionShelfMismatch,
  sendHttpError,
  shelfWarehouseMismatch,
};
