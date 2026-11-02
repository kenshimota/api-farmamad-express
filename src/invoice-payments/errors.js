const {
  createHttpError,
  createPersistenceErrorHandler,
} = require("../shared/http-error");

const INVOICE_NOT_FOUND_MESSAGE = "Invoice not found";
const PAYMENT_NOT_FOUND_MESSAGE = "Payment not found";
const INVOICE_ALREADY_PAID_MESSAGE = "Invoice is already paid";
const PAYMENT_ALREADY_ALLOCATED_MESSAGE =
  "Payment already allocated to this invoice";
const INSUFFICIENT_WALLET_BALANCE_MESSAGE = "Insufficient wallet balance";
const PAYMENT_CUSTOMER_MISMATCH_MESSAGE =
  "Payment does not belong to invoice customer";
const PAYMENT_NOT_CONCILIATED_MESSAGE = "Payment is not conciliated";
const AMOUNT_EXCEEDS_INVOICE_BALANCE_MESSAGE = "Amount exceeds invoice balance";

/**
 * Builds an error that carries the HTTP status and body the router sends.
 * @param {number} status - HTTP status code.
 * @param {object} body - JSON response body.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function httpError(status, body) {
  return createHttpError(status, body, "Invoice payment error");
}

/**
 * 404 response for an unknown invoice or another customer's invoice.
 * @returns {Error} The HTTP error.
 */
function invoiceNotFound() {
  return httpError(404, { message: INVOICE_NOT_FOUND_MESSAGE });
}

/**
 * 404 response for an unknown payment.
 * @returns {Error} The HTTP error.
 */
function paymentNotFound() {
  return httpError(404, { message: PAYMENT_NOT_FOUND_MESSAGE });
}

/**
 * 422 response when the payment and invoice customers differ.
 * @returns {Error} The HTTP error.
 */
function paymentCustomerMismatch() {
  return httpError(422, {
    errors: { payment_id: PAYMENT_CUSTOMER_MISMATCH_MESSAGE },
  });
}

/**
 * 422 response when the payment is still pending or was rejected.
 * @returns {Error} The HTTP error.
 */
function paymentNotConciliated() {
  return httpError(422, {
    errors: { payment_id: PAYMENT_NOT_CONCILIATED_MESSAGE },
  });
}

/**
 * 422 response when the applied amount exceeds the invoice balance.
 * @returns {Error} The HTTP error.
 */
function amountExceedsInvoiceBalance() {
  return httpError(422, {
    errors: { amount: AMOUNT_EXCEEDS_INVOICE_BALANCE_MESSAGE },
  });
}

/**
 * 409 response when the invoice is already fully paid.
 * @returns {Error} The HTTP error.
 */
function invoiceAlreadyPaid() {
  return httpError(409, { message: INVOICE_ALREADY_PAID_MESSAGE });
}

/**
 * 409 response when the payment is already allocated to the invoice.
 * @returns {Error} The HTTP error.
 */
function paymentAlreadyAllocated() {
  return httpError(409, {
    message: PAYMENT_ALREADY_ALLOCATED_MESSAGE,
  });
}

/**
 * 409 response when the wallet cannot cover the payment amount.
 * @returns {Error} The HTTP error.
 */
function insufficientWalletBalance() {
  return httpError(409, {
    message: INSUFFICIENT_WALLET_BALANCE_MESSAGE,
  });
}

/**
 * Translates persistence errors of the invoice payment writes. A unique
 * violation is the database-level duplicate allocation guard; unexpected
 * errors go to the global handler.
 */
const handleInvoicePaymentError = createPersistenceErrorHandler({
  unique: paymentAlreadyAllocated,
});

module.exports = {
  AMOUNT_EXCEEDS_INVOICE_BALANCE_MESSAGE,
  INSUFFICIENT_WALLET_BALANCE_MESSAGE,
  INVOICE_ALREADY_PAID_MESSAGE,
  INVOICE_NOT_FOUND_MESSAGE,
  PAYMENT_ALREADY_ALLOCATED_MESSAGE,
  PAYMENT_CUSTOMER_MISMATCH_MESSAGE,
  PAYMENT_NOT_CONCILIATED_MESSAGE,
  PAYMENT_NOT_FOUND_MESSAGE,
  amountExceedsInvoiceBalance,
  handleInvoicePaymentError,
  httpError,
  insufficientWalletBalance,
  invoiceAlreadyPaid,
  invoiceNotFound,
  paymentAlreadyAllocated,
  paymentCustomerMismatch,
  paymentNotConciliated,
  paymentNotFound,
};
