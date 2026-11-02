const { parsePositiveInteger } = require("../shared/parsers");

const INVALID_PRODUCT_ID_MESSAGE = "Invalid product id";
const INVALID_ITEM_STATE_ID_MESSAGE = "Invalid item state id";
const INVALID_ITEM_STATE_MESSAGE = "Invalid item state";
const MISSING_CUSTOMER_ID_MESSAGE = "customer_id is required";

/**
 * Parses the product id from the route.
 * @param {unknown} value - Raw path value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseProductId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `item_state_id` query filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseItemStateId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `customer_id` query value used by staff roles.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseCustomerId(value) {
  return parsePositiveInteger(value);
}

module.exports = {
  INVALID_ITEM_STATE_ID_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  INVALID_PRODUCT_ID_MESSAGE,
  MISSING_CUSTOMER_ID_MESSAGE,
  parseCustomerId,
  parseItemStateId,
  parseProductId,
};
