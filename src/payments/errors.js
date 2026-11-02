const {
  createHttpError,
  createPersistenceErrorHandler,
} = require("../shared/http-error");
const {
  InvalidImageDimensionsError,
  InvalidImageError,
} = require("../products/image-errors");

/**
 * Builds an error that carries the HTTP status and body the payments router
 * must send.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  return createHttpError(status, body, "Payment error");
}

/**
 * 422 response for a malformed payment id.
 * @returns {Error} The HTTP error.
 */
function invalidPaymentId() {
  return httpError(422, { errors: { id: "Invalid payment id" } });
}

/**
 * 404 response for an unknown payment.
 * @returns {Error} The HTTP error.
 */
function paymentNotFound() {
  return httpError(404, { message: "Payment not found" });
}

/**
 * 404 response for an unknown customer.
 * @returns {Error} The HTTP error.
 */
function customerNotFound() {
  return httpError(404, { message: "Customer not found" });
}

/**
 * 404 response for an unknown payment method.
 * @returns {Error} The HTTP error.
 */
function methodPaymentNotFound() {
  return httpError(404, { message: "Payment method not found" });
}

/**
 * 422 response for an inactive method, type or currency.
 * @returns {Error} The HTTP error.
 */
function invalidMethodPayment() {
  return httpError(422, {
    errors: { method_payment_id: "Invalid payment method" },
  });
}

/**
 * 422 response for an immutable field sent with another value.
 * @param {string} field - Field name.
 * @returns {Error} The HTTP error.
 */
function immutableField(field) {
  return httpError(422, { errors: { [field]: `${field} cannot be changed` } });
}

/**
 * 422 response for an unknown requested status.
 * @returns {Error} The HTTP error.
 */
function invalidStatus() {
  return httpError(422, { errors: { status: "Invalid status" } });
}

/**
 * 422 response for a repeated or terminal status transition.
 * @returns {Error} The HTTP error.
 */
function invalidStatusTransition() {
  return httpError(422, {
    errors: { status: "Invalid status transition" },
  });
}

/**
 * 422 response when a rejected payment has no meaningful reason.
 * @returns {Error} The HTTP error.
 */
function rejectionReasonRequired() {
  return httpError(422, {
    errors: { reason: "reason is required when the payment is rejected" },
  });
}

/**
 * 409 response when the payment already has invoice allocations.
 * @returns {Error} The HTTP error.
 */
function paymentHasAllocations() {
  return httpError(409, { message: "Payment has allocations" });
}

/**
 * 409 response when deleting a payment would leave a negative wallet balance.
 * @returns {Error} The HTTP error.
 */
function walletBalanceWouldBeNegative() {
  return httpError(409, {
    message: "Wallet balance would become negative",
  });
}

/**
 * 409 response when the deposit movement of a payment cannot be found.
 * @returns {Error} The HTTP error.
 */
function depositNotFound() {
  return httpError(409, { message: "Payment deposit not found" });
}

/**
 * Translates the persistence errors of the payment writes and the image
 * validation errors raised by the shared sharp pipeline.
 */
const handlePersistenceError = createPersistenceErrorHandler({
  foreignKey: customerNotFound,
});

/**
 * Answers the documented image validation error or delegates to the
 * persistence translator.
 * @param {unknown} error - Error thrown by the service.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 */
function handlePaymentError(error, res) {
  if (
    error instanceof InvalidImageError ||
    error instanceof InvalidImageDimensionsError
  ) {
    return res.status(422).json({ errors: { image: "Invalid image" } });
  }

  return handlePersistenceError(error, res);
}

module.exports = {
  customerNotFound,
  depositNotFound,
  handlePaymentError,
  httpError,
  immutableField,
  invalidMethodPayment,
  invalidPaymentId,
  invalidStatus,
  invalidStatusTransition,
  methodPaymentNotFound,
  paymentHasAllocations,
  paymentNotFound,
  rejectionReasonRequired,
  walletBalanceWouldBeNegative,
};
