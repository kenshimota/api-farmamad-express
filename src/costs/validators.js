const yup = require("yup");

const REQUIRED_COST_FIELDS = ["product_id", "item_state_id", "cost"];
const MAX_COST = 999999999.99;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const PRODUCT_ID_MESSAGE = "Invalid product";
const ITEM_STATE_ID_MESSAGE = "Invalid item state";
const CURRENCY_ID_MESSAGE = "Invalid currency";
const PRODUCT_FILTER_MESSAGE = "Invalid product id";
const ITEM_STATE_FILTER_MESSAGE = "Invalid item state id";
const CURRENCY_FILTER_MESSAGE = "Invalid currency id";
const COST_MESSAGE = "cost must be a number";
const COST_NEGATIVE_MESSAGE = "cost must be >= 0";
const COST_DECIMALS_MESSAGE = "cost must have at most 2 decimals";
const COST_INTEGER_DIGITS_MESSAGE = "cost must have at most 9 integer digits";

/**
 * Builds a schema for a required positive integer identifier.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function positiveInteger(message, required = true) {
  const schema = yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message);

  return required ? schema.required(message) : schema;
}

/**
 * Tells whether a numeric value has at most two decimal places, allowing for
 * the usual binary floating point representation error.
 * @param {number} value - Numeric value already cast by yup.
 * @returns {boolean} True when the value fits DECIMAL(12,2) decimals.
 */
function hasAtMostTwoDecimals(value) {
  if (!Number.isFinite(value)) {
    return false;
  }

  const scaled = value * 100;
  const tolerance = Number.EPSILON * Math.abs(scaled) * 4;

  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

/**
 * Builds the monetary schema: a required number (numeric strings are cast)
 * greater than or equal to zero, with at most two decimals and nine integer
 * digits, matching DECIMAL(12,2).
 * @returns {import("yup").NumberSchema} The cost schema.
 */
function costField() {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (originalValue === null) {
        return NaN;
      }

      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(COST_MESSAGE)
    .test("is-number", COST_MESSAGE, function isNumber(value) {
      if (value === undefined) {
        return true;
      }

      return (
        typeof this.originalValue === "number" ||
        (typeof this.originalValue === "string" &&
          this.originalValue.trim() !== "")
      );
    })
    .min(0, COST_NEGATIVE_MESSAGE)
    .max(MAX_COST, COST_INTEGER_DIGITS_MESSAGE)
    .test("max-decimals", COST_DECIMALS_MESSAGE, (value) =>
      value === undefined ? true : hasAtMostTwoDecimals(value),
    );
}

const createCostSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE),
  cost: costField(),
  currency_id: positiveInteger(CURRENCY_ID_MESSAGE, false),
});

const updateCostSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE, false),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE, false),
  cost: costField(),
  currency_id: positiveInteger(CURRENCY_ID_MESSAGE, false),
});

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
 * Parses a cost id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseCostId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `product_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseProductId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `item_state_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseItemStateId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the optional `currency_id` listing filter.
 * @param {unknown} value - Raw query value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseCurrencyId(value) {
  return parsePositiveInteger(value);
}

module.exports = {
  COST_DECIMALS_MESSAGE,
  COST_INTEGER_DIGITS_MESSAGE,
  COST_MESSAGE,
  COST_NEGATIVE_MESSAGE,
  CURRENCY_FILTER_MESSAGE,
  CURRENCY_ID_MESSAGE,
  ITEM_STATE_FILTER_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  MAX_COST,
  parseCostId,
  parseCurrencyId,
  parseItemStateId,
  parseProductId,
  PRODUCT_FILTER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  REQUIRED_COST_FIELDS,
  createCostSchema,
  updateCostSchema,
};
