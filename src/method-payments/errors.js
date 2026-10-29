const {
  createHttpError,
  createPersistenceErrorHandler,
  sendHttpError,
} = require("../shared/http-error");

/**
 * Builds an error that carries the HTTP status and body a router must send.
 * The service layer throws these errors and stays free of Express objects.
 * Details values are never copied into the message or the body by this helper.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  return createHttpError(status, body, "Payment method error");
}

/**
 * 422 response for a malformed method payment id.
 * @returns {Error} The HTTP error.
 */
function invalidMethodPaymentId() {
  return httpError(422, {
    errors: { id: "Invalid payment method id" },
  });
}

/**
 * 404 response for an unknown method payment.
 * @returns {Error} The HTTP error.
 */
function methodPaymentNotFound() {
  return httpError(404, { message: "Payment method not found" });
}

/**
 * 409 response for a duplicated label inside the same type.
 * @returns {Error} The HTTP error.
 */
function methodPaymentAlreadyExists() {
  return httpError(409, { message: "Payment method already exists" });
}

/**
 * 409 response used when another table still references the method.
 * @returns {Error} The HTTP error.
 */
function methodPaymentInUse() {
  return httpError(409, { message: "Payment method is in use" });
}

/**
 * 422 response for a missing, inactive or malformed payment type.
 * @returns {Error} The HTTP error.
 */
function invalidPaymentType() {
  return httpError(422, {
    errors: { method_payment_type_id: "Invalid payment type" },
  });
}

/**
 * 422 response when a PUT tries to change the immutable payment type.
 * @returns {Error} The HTTP error.
 */
function immutablePaymentType() {
  return httpError(422, {
    errors: {
      method_payment_type_id: "method_payment_type_id cannot be changed",
    },
  });
}

/**
 * 422 response carrying the dynamic details field errors.
 * @param {Record<string, string>} errors - Field-prefixed error messages.
 * @returns {Error} The HTTP error.
 */
function invalidDetails(errors) {
  return httpError(422, { errors });
}

/**
 * Builds a persistence error handler from the strategies each operation needs.
 * @param {object} [strategies] - Error factories per persistence constraint.
 * @param {() => Error} [strategies.unique] - Duplicated label mapping.
 * @param {() => Error} [strategies.foreignKey] - Foreign key mapping.
 * @returns {(error: unknown, res: import("express").Response) =>
 *   import("express").Response} The translation middleware body.
 * @throws {unknown} The original error when it cannot be classified.
 */
function createMethodPaymentErrorHandler(strategies) {
  return createPersistenceErrorHandler(strategies);
}

/**
 * Translates the persistence errors of create and update. A duplicated label
 * answers 409 and an invalid type reference answers 422.
 */
const handleMethodPaymentError = createMethodPaymentErrorHandler({
  unique: methodPaymentAlreadyExists,
  foreignKey: invalidPaymentType,
});

/**
 * Translates the persistence errors of delete. A foreign key violation means
 * another table still references the method, so it answers 409.
 */
const handleMethodPaymentDeleteError = createMethodPaymentErrorHandler({
  foreignKey: methodPaymentInUse,
});

module.exports = {
  createMethodPaymentErrorHandler,
  handleMethodPaymentDeleteError,
  handleMethodPaymentError,
  httpError,
  immutablePaymentType,
  invalidDetails,
  invalidMethodPaymentId,
  invalidPaymentType,
  methodPaymentAlreadyExists,
  methodPaymentInUse,
  methodPaymentNotFound,
  sendHttpError,
};
