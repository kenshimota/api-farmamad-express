const { parsePositiveInteger } = require("../shared/parsers");

const PAYMENT_STATUSES = Object.freeze(["pending", "partial", "paid"]);

const PAYMENT_STATUS_MESSAGE = "Invalid payment status";
const ORDER_FILTER_MESSAGE = "Invalid order id";
const CUSTOMER_FILTER_MESSAGE = "Invalid customer id";
const NUMBER_FILTER_MESSAGE = "Invalid number";
const INVOICE_ID_MESSAGE = "Invalid invoice id";

/**
 * Parses an invoice id from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseInvoiceId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `order_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseOrderFilter(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `customer_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseCustomerFilter(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `number` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseNumberFilter(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `payment_status` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} One of the three statuses or null when invalid.
 */
function parsePaymentStatusFilter(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return PAYMENT_STATUSES.includes(trimmed) ? trimmed : null;
}

module.exports = {
  CUSTOMER_FILTER_MESSAGE,
  INVOICE_ID_MESSAGE,
  NUMBER_FILTER_MESSAGE,
  ORDER_FILTER_MESSAGE,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_MESSAGE,
  parseCustomerFilter,
  parseInvoiceId,
  parseNumberFilter,
  parseOrderFilter,
  parsePaymentStatusFilter,
};
