const { createHttpError } = require("../shared/http-error");
const { CUSTOMER_PRICE_LIST_MESSAGE } = require("../pricing");

const CUSTOMER_NOT_LINKED_MESSAGE = "Customer profile is not linked";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found";
const FORBIDDEN_MESSAGE = "Forbidden";
const UNAUTHORIZED_MESSAGE = "Unauthorized";
const INSUFFICIENT_STOCK_MESSAGE = "Insufficient stock";
const INSUFFICIENT_WALLET_MESSAGE = "Insufficient wallet balance";
const ORDER_NOT_FOUND_MESSAGE = "Order not found";
const ORDER_ITEM_NOT_FOUND_MESSAGE = "Order item not found";
const ORDER_NOT_EDITABLE_MESSAGE = "Order is not editable";
const ORDER_STATUS_INCOMPLETE_MESSAGE =
  "Order status configuration is incomplete";
const PAYMENT_TERM_REQUIRED_MESSAGE = "Payment term is required";
const INVALID_PAYMENT_TERM_MESSAGE = "Invalid payment term";
const INVALID_STATUS_TRANSITION_MESSAGE = "Invalid status transition";
const INVALID_STATUS_MESSAGE = "Invalid status";
const INVALID_ITEM_STATE_MESSAGE = "Invalid item state";
const NO_PRICE_MESSAGE =
  "Product has no price for this item state and price list";
const DUPLICATED_ITEM_MESSAGE = "Product and item state already in order";
const ITEM_LIMIT_MESSAGE = "Order cannot have more than 50 lines";
const SELLER_NOT_ASSIGNED_MESSAGE = "Customer is not assigned to this seller";
const EMPTY_ORDER_MESSAGE = "Order must have at least one line";

/**
 * 401 response for a missing or unknown authenticated user.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function unauthorized() {
  return createHttpError(401, { message: UNAUTHORIZED_MESSAGE });
}

/**
 * 403 response for a role without permission.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function forbidden() {
  return createHttpError(403, { message: FORBIDDEN_MESSAGE });
}

/**
 * 403 response for a customer user without a linked `users.customer_id`.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function customerProfileNotLinked() {
  return createHttpError(403, { message: CUSTOMER_NOT_LINKED_MESSAGE });
}

/**
 * 404 response for an unknown target customer.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function customerNotFound() {
  return createHttpError(404, { message: CUSTOMER_NOT_FOUND_MESSAGE });
}

/**
 * 403 response for a customer without `customers.price_list_id`.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function priceListNotAssigned() {
  return createHttpError(403, { message: CUSTOMER_PRICE_LIST_MESSAGE });
}

/**
 * 403 response for a seller that does not have the customer assigned.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function sellerNotAssigned() {
  return createHttpError(403, { message: SELLER_NOT_ASSIGNED_MESSAGE });
}

/**
 * 404 response for an order hidden from the authenticated user.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderNotFound() {
  return createHttpError(404, { message: ORDER_NOT_FOUND_MESSAGE });
}

/**
 * 404 response for an unknown or hidden order line.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderItemNotFound() {
  return createHttpError(404, { message: ORDER_ITEM_NOT_FOUND_MESSAGE });
}

/**
 * 422 response used when an order is no longer editable.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderNotEditable() {
  return createHttpError(422, {
    errors: { status: ORDER_NOT_EDITABLE_MESSAGE },
  });
}

/**
 * 422 response for an unknown, repeated or disallowed status transition.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidStatusTransition() {
  return createHttpError(422, {
    errors: { status: INVALID_STATUS_TRANSITION_MESSAGE },
  });
}

/**
 * 422 response for a status code that is not in the catalog.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidStatus() {
  return createHttpError(422, {
    errors: { status: INVALID_STATUS_MESSAGE },
  });
}

/**
 * 422 response for an unknown or non-sellable item state.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidItemState() {
  return createHttpError(422, {
    errors: { item_state_id: INVALID_ITEM_STATE_MESSAGE },
  });
}

/**
 * 422 response for a product without a resolvable price for the line.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function productNotAvailable() {
  return createHttpError(422, {
    errors: { product_id: NO_PRICE_MESSAGE },
  });
}

/**
 * 409 response for a duplicated `(product_id, item_state_id)` pair.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function duplicatedItem() {
  return createHttpError(409, { message: DUPLICATED_ITEM_MESSAGE });
}

/**
 * 422 response used when an order would exceed the line limit.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function itemLimitReached() {
  return createHttpError(422, { errors: { items: ITEM_LIMIT_MESSAGE } });
}

/**
 * 409 response listing the lines without enough available stock.
 * @param {Array<{ product_id: number, item_state_id: number }>} items -
 *   Missing product/state pairs.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function insufficientStock(items) {
  return createHttpError(409, {
    message: INSUFFICIENT_STOCK_MESSAGE,
    items,
  });
}

/**
 * 409 response used when a cash order exceeds the customer wallet balance.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function insufficientWalletBalance() {
  return createHttpError(409, { message: INSUFFICIENT_WALLET_MESSAGE });
}

/**
 * 422 response used when a transition requires a payment term and none is set.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function paymentTermRequired() {
  return createHttpError(422, {
    errors: { payment_term_id: PAYMENT_TERM_REQUIRED_MESSAGE },
  });
}

/**
 * 422 response used when the configured payment term is inactive or missing.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidPaymentTerm() {
  return createHttpError(422, {
    errors: { payment_term_id: INVALID_PAYMENT_TERM_MESSAGE },
  });
}

/**
 * 422 response used when a request or generation has no lines.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderWithoutItems() {
  return createHttpError(422, { errors: { items: EMPTY_ORDER_MESSAGE } });
}

/**
 * 503 response used when the base order statuses are missing.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function configurationIncomplete() {
  return createHttpError(503, { message: ORDER_STATUS_INCOMPLETE_MESSAGE });
}

module.exports = {
  CUSTOMER_NOT_FOUND_MESSAGE,
  CUSTOMER_NOT_LINKED_MESSAGE,
  DUPLICATED_ITEM_MESSAGE,
  EMPTY_ORDER_MESSAGE,
  FORBIDDEN_MESSAGE,
  INSUFFICIENT_STOCK_MESSAGE,
  INSUFFICIENT_WALLET_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  INVALID_PAYMENT_TERM_MESSAGE,
  INVALID_STATUS_MESSAGE,
  INVALID_STATUS_TRANSITION_MESSAGE,
  ITEM_LIMIT_MESSAGE,
  NO_PRICE_MESSAGE,
  ORDER_ITEM_NOT_FOUND_MESSAGE,
  ORDER_NOT_EDITABLE_MESSAGE,
  ORDER_NOT_FOUND_MESSAGE,
  ORDER_STATUS_INCOMPLETE_MESSAGE,
  PAYMENT_TERM_REQUIRED_MESSAGE,
  SELLER_NOT_ASSIGNED_MESSAGE,
  UNAUTHORIZED_MESSAGE,
  configurationIncomplete,
  customerNotFound,
  customerProfileNotLinked,
  duplicatedItem,
  forbidden,
  insufficientStock,
  insufficientWalletBalance,
  invalidItemState,
  invalidPaymentTerm,
  invalidStatus,
  invalidStatusTransition,
  itemLimitReached,
  orderItemNotFound,
  orderNotEditable,
  orderNotFound,
  orderWithoutItems,
  paymentTermRequired,
  priceListNotAssigned,
  productNotAvailable,
  sellerNotAssigned,
  unauthorized,
};
