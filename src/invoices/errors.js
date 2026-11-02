const { createHttpError } = require("../shared/http-error");

const INVOICE_NOT_FOUND_MESSAGE = "Invoice not found";
const CUSTOMER_NOT_LINKED_MESSAGE = "Customer profile is not linked";
const ORDER_ALREADY_INVOICED_MESSAGE = "Order already has an invoice";
const ORDER_NOT_INVOICABLE_MESSAGE = "Order cannot be invoiced";
const FORBIDDEN_MESSAGE = "Forbidden";
const PAYMENT_TERM_REQUIRED_MESSAGE = "Payment term is required";
const INVALID_PAYMENT_TERM_MESSAGE = "Invalid payment term";

/**
 * 404 response for an unknown invoice or an invoice owned by another customer.
 * @returns {Error} The HTTP error.
 */
function invoiceNotFound() {
  return createHttpError(404, { message: INVOICE_NOT_FOUND_MESSAGE });
}

/**
 * 403 response for a role without permission.
 * @returns {Error} The HTTP error.
 */
function forbidden() {
  return createHttpError(403, { message: FORBIDDEN_MESSAGE });
}

/**
 * 403 response for a customer user without a linked `users.customer_id`.
 * @returns {Error} The HTTP error.
 */
function customerProfileNotLinked() {
  return createHttpError(403, { message: CUSTOMER_NOT_LINKED_MESSAGE });
}

/**
 * 409 response used when the order already has an invoice.
 * @returns {Error} The HTTP error.
 */
function orderAlreadyInvoiced() {
  return createHttpError(409, { message: ORDER_ALREADY_INVOICED_MESSAGE });
}

/**
 * 422 response used when an order is not in `generate`.
 * @returns {Error} The HTTP error.
 */
function orderNotInvoicable() {
  return createHttpError(422, {
    errors: { status: ORDER_NOT_INVOICABLE_MESSAGE },
  });
}

/**
 * 422 response used when the order does not have a payment term.
 * @returns {Error} The HTTP error.
 */
function paymentTermRequired() {
  return createHttpError(422, {
    errors: { payment_term_id: PAYMENT_TERM_REQUIRED_MESSAGE },
  });
}

/**
 * 422 response used when the payment term does not exist or is inactive.
 * @returns {Error} The HTTP error.
 */
function invalidPaymentTerm() {
  return createHttpError(422, {
    errors: { payment_term_id: INVALID_PAYMENT_TERM_MESSAGE },
  });
}

/**
 * 422 response for an invalid invoice id.
 * @returns {Error} The HTTP error.
 */
function invalidInvoiceId() {
  return createHttpError(422, { errors: { id: "Invalid invoice id" } });
}

module.exports = {
  CUSTOMER_NOT_LINKED_MESSAGE,
  FORBIDDEN_MESSAGE,
  INVALID_PAYMENT_TERM_MESSAGE,
  INVOICE_NOT_FOUND_MESSAGE,
  ORDER_ALREADY_INVOICED_MESSAGE,
  ORDER_NOT_INVOICABLE_MESSAGE,
  PAYMENT_TERM_REQUIRED_MESSAGE,
  customerProfileNotLinked,
  forbidden,
  invalidInvoiceId,
  invalidPaymentTerm,
  invoiceNotFound,
  orderAlreadyInvoiced,
  orderNotInvoicable,
  paymentTermRequired,
};
