const { createHttpError } = require("../shared/http-error");

const ORDER_ALREADY_INVOICED_MESSAGE = "Order is already invoiced";
const ORDER_CANCELLED_MESSAGE = "Order is cancelled";
const ORDER_WITHOUT_ITEMS_MESSAGE = "Order has no items";
const ORDER_NOT_QUOTABLE_MESSAGE = "Order is not quotable";
const CURRENCY_NOT_FOUND_MESSAGE = "Currency not found";
const INVALID_CURRENCY_MESSAGE = "Invalid currency";
const CURRENCY_INCOMPLETE_MESSAGE = "Currency configuration is incomplete";
const COMPANY_NOT_CONFIGURED_MESSAGE = "Company profile is not configured";

/**
 * 409 response for an order that already has an invoice.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderAlreadyInvoiced() {
  return createHttpError(409, { message: ORDER_ALREADY_INVOICED_MESSAGE });
}

/**
 * 409 response for a cancelled order.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderCancelled() {
  return createHttpError(409, { message: ORDER_CANCELLED_MESSAGE });
}

/**
 * 422 response for an order without lines.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderWithoutItems() {
  return createHttpError(422, {
    errors: { items: ORDER_WITHOUT_ITEMS_MESSAGE },
  });
}

/**
 * 422 response for a status that cannot be quoted.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderNotQuotable() {
  return createHttpError(422, {
    errors: { status: ORDER_NOT_QUOTABLE_MESSAGE },
  });
}

/**
 * 404 response for an unknown target currency.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function currencyNotFound() {
  return createHttpError(404, { message: CURRENCY_NOT_FOUND_MESSAGE });
}

/**
 * 422 response for an inactive target currency.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidCurrency() {
  return createHttpError(422, {
    errors: { currency_id: INVALID_CURRENCY_MESSAGE },
  });
}

/**
 * 503 response for incomplete currency configuration.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function currencyConfigurationIncomplete() {
  return createHttpError(503, { message: CURRENCY_INCOMPLETE_MESSAGE });
}

/**
 * 503 response for a missing emitter profile.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function companyProfileNotConfigured() {
  return createHttpError(503, { message: COMPANY_NOT_CONFIGURED_MESSAGE });
}

module.exports = {
  COMPANY_NOT_CONFIGURED_MESSAGE,
  CURRENCY_INCOMPLETE_MESSAGE,
  CURRENCY_NOT_FOUND_MESSAGE,
  INVALID_CURRENCY_MESSAGE,
  ORDER_ALREADY_INVOICED_MESSAGE,
  ORDER_CANCELLED_MESSAGE,
  ORDER_NOT_QUOTABLE_MESSAGE,
  ORDER_WITHOUT_ITEMS_MESSAGE,
  companyProfileNotConfigured,
  currencyConfigurationIncomplete,
  currencyNotFound,
  invalidCurrency,
  orderAlreadyInvoiced,
  orderCancelled,
  orderNotQuotable,
  orderWithoutItems,
};
