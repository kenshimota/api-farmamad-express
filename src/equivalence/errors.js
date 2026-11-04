const { createHttpError } = require("../shared/http-error");

const CURRENCY_NOT_FOUND_MESSAGE = "Currency not found";
const INCOMPLETE_CURRENCY_MESSAGE = "Currency configuration is incomplete";
const INVALID_CURRENCY_ID_MESSAGE = "Invalid currency_id";
const INVALID_CURRENCY_MESSAGE = "Invalid currency";
const INVALID_ORDER_ID_MESSAGE = "Invalid order id";
const INVALID_INVOICE_ID_MESSAGE = "Invalid invoice id";

/**
 * 422 response for an invalid order id.
 * @returns {Error} The HTTP error.
 */
function invalidOrderId() {
  return createHttpError(422, {
    errors: { id: INVALID_ORDER_ID_MESSAGE },
  });
}

/**
 * 422 response for an invalid invoice id.
 * @returns {Error} The HTTP error.
 */
function invalidInvoiceId() {
  return createHttpError(422, {
    errors: { id: INVALID_INVOICE_ID_MESSAGE },
  });
}

/**
 * 422 response for a malformed `currency_id` query value.
 * @returns {Error} The HTTP error.
 */
function invalidCurrencyId() {
  return createHttpError(422, {
    errors: { currency_id: INVALID_CURRENCY_ID_MESSAGE },
  });
}

/**
 * 404 response for an unknown target currency.
 * @returns {Error} The HTTP error.
 */
function currencyNotFound() {
  return createHttpError(404, { message: CURRENCY_NOT_FOUND_MESSAGE });
}

/**
 * 422 response for an inactive target currency.
 * @returns {Error} The HTTP error.
 */
function invalidCurrency() {
  return createHttpError(422, {
    errors: { currency_id: INVALID_CURRENCY_MESSAGE },
  });
}

/**
 * 503 response when the base currency or one of the rates is missing.
 * @returns {Error} The HTTP error.
 */
function incompleteCurrencyConfiguration() {
  return createHttpError(503, { message: INCOMPLETE_CURRENCY_MESSAGE });
}

module.exports = {
  CURRENCY_NOT_FOUND_MESSAGE,
  INCOMPLETE_CURRENCY_MESSAGE,
  INVALID_CURRENCY_ID_MESSAGE,
  INVALID_CURRENCY_MESSAGE,
  INVALID_INVOICE_ID_MESSAGE,
  INVALID_ORDER_ID_MESSAGE,
  currencyNotFound,
  incompleteCurrencyConfiguration,
  invalidCurrency,
  invalidCurrencyId,
  invalidInvoiceId,
  invalidOrderId,
};
