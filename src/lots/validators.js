const yup = require("yup");
const {
  DATE_PATTERN,
  MAX_NUMBER_LENGTH,
  isCalendarDate,
} = require("./parsers");

const REQUIRED_LOT_FIELDS = Object.freeze([
  "number",
  "product_id",
  "expiration_date",
  "item_state_id",
  "warehouse_id",
  "shelf_id",
  "section_id",
]);
const REQUIRED_UPDATE_FIELDS = Object.freeze([
  "number",
  "product_id",
  "expiration_date",
  "item_state_id",
  "stock",
  "reserved",
  "warehouse_id",
  "shelf_id",
  "section_id",
]);
const MAX_QUANTITY = 1000000000;

const NUMBER_MESSAGE = `number must have between 1 and ${MAX_NUMBER_LENGTH} characters`;
const PRODUCT_ID_MESSAGE = "Invalid product id";
const ITEM_STATE_ID_MESSAGE = "Invalid item state id";
const WAREHOUSE_ID_MESSAGE = "Invalid warehouse id";
const SHELF_ID_MESSAGE = "Invalid shelf id";
const SECTION_ID_MESSAGE = "Invalid section id";
const EXPIRATION_DATE_MESSAGE =
  "expiration_date must be a valid date (YYYY-MM-DD)";
const STOCK_MESSAGE = `stock must be an integer between 0 and ${MAX_QUANTITY}`;
const RESERVED_MESSAGE = `reserved must be an integer between 0 and ${MAX_QUANTITY}`;
const RESERVED_STOCK_MESSAGE = "reserved cannot exceed stock";
const NUMBER_FILTER_MESSAGE = "Invalid number";
const EXPIRED_MESSAGE = "expired must be a boolean";
const EXPIRING_BEFORE_MESSAGE =
  "expiring_before must be a valid date (YYYY-MM-DD)";

/**
 * Builds the trimmed lot number schema.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The number schema.
 */
function numberField(required = false) {
  const schema = yup
    .string()
    .trim()
    .typeError(NUMBER_MESSAGE)
    .min(1, NUMBER_MESSAGE)
    .max(MAX_NUMBER_LENGTH, NUMBER_MESSAGE);

  return required ? schema.required(NUMBER_MESSAGE) : schema;
}

/**
 * Builds a required positive integer identifier schema.
 * @param {string} message - Error message for invalid values.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function positiveIntegerField(message, required = true) {
  const schema = yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message);

  return required ? schema.required(message) : schema;
}

/**
 * Builds a date-only schema that rejects impossible calendar dates.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The date schema.
 */
function expirationDateField(required = false) {
  const schema = yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(EXPIRATION_DATE_MESSAGE)
    .matches(DATE_PATTERN, EXPIRATION_DATE_MESSAGE)
    .test(
      "calendar-date",
      EXPIRATION_DATE_MESSAGE,
      (value) => value === undefined || isCalendarDate(value),
    );

  return required ? schema.required(EXPIRATION_DATE_MESSAGE) : schema;
}

/**
 * Builds an integer quantity schema between zero and the documented maximum.
 * @param {string} message - Error message for invalid values.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The quantity schema.
 */
function quantityField(message, required = false) {
  const schema = yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(0, message)
    .max(MAX_QUANTITY, message);

  return required ? schema.required(message) : schema;
}

/**
 * Adds the cross-field rule `reserved <= stock` so the error is reported under
 * the `reserved` key, exactly as the API contract documents.
 * @param {import("yup").NumberSchema} schema - Reserved schema.
 * @returns {import("yup").NumberSchema} The schema with the cross-field test.
 */
function withinStock(schema) {
  return schema.test(
    "reserved-within-stock",
    RESERVED_STOCK_MESSAGE,
    function validate(value) {
      const stock = this.parent.stock;

      return (
        value === undefined ||
        stock === undefined ||
        Number(value) <= Number(stock)
      );
    },
  );
}

const createLotSchema = yup.object({
  number: numberField(true),
  product_id: positiveIntegerField(PRODUCT_ID_MESSAGE),
  expiration_date: expirationDateField(true),
  item_state_id: positiveIntegerField(ITEM_STATE_ID_MESSAGE),
  stock: quantityField(STOCK_MESSAGE).default(0),
  reserved: withinStock(quantityField(RESERVED_MESSAGE).default(0)),
  warehouse_id: positiveIntegerField(WAREHOUSE_ID_MESSAGE),
  shelf_id: positiveIntegerField(SHELF_ID_MESSAGE),
  section_id: positiveIntegerField(SECTION_ID_MESSAGE),
});

const updateLotSchema = yup.object({
  number: numberField(true),
  product_id: positiveIntegerField(PRODUCT_ID_MESSAGE),
  expiration_date: expirationDateField(true),
  item_state_id: positiveIntegerField(ITEM_STATE_ID_MESSAGE),
  stock: quantityField(STOCK_MESSAGE, true),
  reserved: withinStock(quantityField(RESERVED_MESSAGE, true)),
  warehouse_id: positiveIntegerField(WAREHOUSE_ID_MESSAGE),
  shelf_id: positiveIntegerField(SHELF_ID_MESSAGE),
  section_id: positiveIntegerField(SECTION_ID_MESSAGE),
});

module.exports = {
  EXPIRED_MESSAGE,
  EXPIRATION_DATE_MESSAGE,
  EXPIRING_BEFORE_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  MAX_NUMBER_LENGTH,
  MAX_QUANTITY,
  NUMBER_FILTER_MESSAGE,
  NUMBER_MESSAGE,
  PRODUCT_ID_MESSAGE,
  REQUIRED_LOT_FIELDS,
  REQUIRED_UPDATE_FIELDS,
  RESERVED_MESSAGE,
  RESERVED_STOCK_MESSAGE,
  SECTION_ID_MESSAGE,
  SHELF_ID_MESSAGE,
  STOCK_MESSAGE,
  WAREHOUSE_ID_MESSAGE,
  createLotSchema,
  updateLotSchema,
};
