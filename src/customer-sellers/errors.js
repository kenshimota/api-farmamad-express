const { UniqueConstraintError } = require("sequelize");
const {
  INVALID_CUSTOMER_MESSAGE,
  INVALID_SELLER_MESSAGE,
} = require("./validators");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  const error = new Error(body.message ?? "Customer seller error");

  error.status = status;
  error.body = body;

  return error;
}

/**
 * 422 response for an invalid assignment id.
 * @returns {Error} The HTTP error.
 */
function invalidAssignmentId() {
  return httpError(422, { errors: { id: "Invalid assignment id" } });
}

/**
 * 404 response for an unknown assignment.
 * @returns {Error} The HTTP error.
 */
function assignmentNotFound() {
  return httpError(404, { message: "Assignment not found" });
}

/**
 * 422 response for an unknown customer.
 * @returns {Error} The HTTP error.
 */
function invalidCustomer() {
  return httpError(422, {
    errors: { customer_id: INVALID_CUSTOMER_MESSAGE },
  });
}

/**
 * 422 response for an unknown, blocked or non-seller user.
 * @returns {Error} The HTTP error.
 */
function invalidSeller() {
  return httpError(422, { errors: { seller_id: INVALID_SELLER_MESSAGE } });
}

/**
 * 409 response when the customer already has a seller.
 * @returns {Error} The HTTP error.
 */
function customerAlreadyAssigned() {
  return httpError(409, { message: "Customer already has a seller" });
}

/**
 * 422 response when a PUT tries to move the assignment to another customer.
 * @returns {Error} The HTTP error.
 */
function customerCannotChange() {
  return httpError(422, {
    errors: { customer_id: "customer_id cannot be changed" },
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
 * Translates the persistence errors of create and update into HTTP responses.
 * A controlled error passes through and a duplicated `customer_id` answers 409,
 * which also covers two concurrent POST requests for the same customer.
 * @param {unknown} error - Error thrown by the service.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The translated response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleWriteError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  if (error instanceof UniqueConstraintError) {
    return sendHttpError(res, customerAlreadyAssigned());
  }

  throw error;
}

module.exports = {
  assignmentNotFound,
  customerAlreadyAssigned,
  customerCannotChange,
  handleWriteError,
  httpError,
  invalidAssignmentId,
  invalidCustomer,
  invalidSeller,
  isHttpError,
  sendHttpError,
};
