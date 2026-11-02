const { createHttpError } = require("../shared/http-error");
const { CUSTOMER_PRICE_LIST_MESSAGE } = require("../pricing");

const CUSTOMER_NOT_LINKED_MESSAGE = "Customer profile is not linked";
const FORBIDDEN_MESSAGE = "Forbidden";
const UNAUTHORIZED_MESSAGE = "Unauthorized";
const INSUFFICIENT_STOCK_MESSAGE = "Insufficient stock";
const ORDER_NOT_FOUND_MESSAGE = "Order not found";
const ORDER_NOT_EDITABLE_MESSAGE = "Order is not editable";

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
 * 403 response for a customer without `customers.price_list_id`.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function priceListNotAssigned() {
  return createHttpError(403, { message: CUSTOMER_PRICE_LIST_MESSAGE });
}

/**
 * 422 response for an item state that does not exist or is not sellable.
 * @param {number} itemStateId - Requested item state id.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function invalidItemState(itemStateId) {
  return createHttpError(422, {
    errors: { items: `Invalid item state ${itemStateId}` },
  });
}

/**
 * 422 response for a product without a resolvable price for the line.
 * @param {number} productId - Requested product id.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function productNotAvailable(productId) {
  return createHttpError(422, {
    errors: { items: `Product ${productId} is not available for sale` },
  });
}

/**
 * 422 response for a duplicated `(product_id, item_state_id)` pair.
 * @param {number} productId - Product id.
 * @param {number} itemStateId - Item state id.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function duplicatedItem(productId, itemStateId) {
  return createHttpError(422, {
    errors: {
      items: `Duplicate product ${productId} and item state ${itemStateId}`,
    },
  });
}

/**
 * 404 response for an unknown order.
 * @returns {Error & { status: number, body: object }} The HTTP error.
 */
function orderNotFound() {
  return createHttpError(404, { message: ORDER_NOT_FOUND_MESSAGE });
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

module.exports = {
  CUSTOMER_NOT_LINKED_MESSAGE,
  FORBIDDEN_MESSAGE,
  INSUFFICIENT_STOCK_MESSAGE,
  ORDER_NOT_EDITABLE_MESSAGE,
  ORDER_NOT_FOUND_MESSAGE,
  UNAUTHORIZED_MESSAGE,
  customerProfileNotLinked,
  duplicatedItem,
  forbidden,
  insufficientStock,
  invalidItemState,
  orderNotEditable,
  orderNotFound,
  priceListNotAssigned,
  productNotAvailable,
  unauthorized,
};
