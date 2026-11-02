const {
  createHttpError,
  createPersistenceErrorHandler,
} = require("../shared/http-error");

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
 * Translates the persistence errors of the payment writes.
 */
const handlePaymentError = createPersistenceErrorHandler({
  foreignKey: customerNotFound,
});

module.exports = {
  customerNotFound,
  depositNotFound,
  handlePaymentError,
  httpError,
  immutableField,
  invalidMethodPayment,
  invalidPaymentId,
  methodPaymentNotFound,
  paymentHasAllocations,
  paymentNotFound,
  walletBalanceWouldBeNegative,
};
