const PURCHASE_STATUSES = Object.freeze(["draft", "confirmed", "cancelled"]);
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const STATUS_MESSAGE = "Invalid status";
const NUMBER_FILTER_MESSAGE = "Invalid number";
const SUPPLIER_FILTER_MESSAGE = "Invalid supplier id";
const CURRENCY_FILTER_MESSAGE = "Invalid currency id";

/**
 * Parses a positive integer identifier coming from a route or query.
 * @param {unknown} value - Raw value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parsePositiveInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  return parsed >= 1 ? parsed : null;
}

/**
 * Parses a purchase id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parsePurchaseId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses a purchase item id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parsePurchaseItemId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `supplier_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseSupplierFilter(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `currency_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseCurrencyFilter(value) {
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
 * Parses the optional `status` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {string|null} One of the three statuses or null when invalid.
 */
function parseStatusFilter(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return PURCHASE_STATUSES.includes(trimmed) ? trimmed : null;
}

module.exports = {
  CURRENCY_FILTER_MESSAGE,
  NUMBER_FILTER_MESSAGE,
  PURCHASE_STATUSES,
  STATUS_MESSAGE,
  SUPPLIER_FILTER_MESSAGE,
  parseCurrencyFilter,
  parseNumberFilter,
  parsePositiveInteger,
  parsePurchaseId,
  parsePurchaseItemId,
  parseStatusFilter,
  parseSupplierFilter,
};
