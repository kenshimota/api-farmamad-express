const yup = require("yup");
const { MAX_MONEY, hasAtMostTwoDecimals } = require("./money");
const {
  DATE_PATTERN,
  MAX_NUMBER_LENGTH,
  isCalendarDate,
} = require("../lots/parsers");

const REQUIRED_PURCHASE_FIELDS = ["supplier_id"];
const EDITABLE_PURCHASE_FIELDS = ["supplier_id", "currency_id", "notes"];
const REQUIRED_PURCHASE_ITEM_FIELDS = [
  "product_id",
  "item_state_id",
  "quantity",
  "unit_cost",
  "tax_amount",
  "lot_number",
  "expiration_date",
];
const EDITABLE_PURCHASE_ITEM_FIELDS = [...REQUIRED_PURCHASE_ITEM_FIELDS];
const MAX_NOTES_LENGTH = 1000;
const MAX_QUANTITY = 1000000;
const SUPPLIER_ID_MESSAGE = "Invalid supplier id";
const CURRENCY_ID_MESSAGE = "Invalid currency";
const PRODUCT_ID_MESSAGE = "Invalid product id";
const ITEM_STATE_ID_MESSAGE = "Invalid item state id";
const QUANTITY_TYPE_MESSAGE = "quantity must be an integer";
const QUANTITY_MIN_MESSAGE = "quantity must be > 0";
const QUANTITY_MAX_MESSAGE = "quantity must be <= 1000000";
const UNIT_COST_MESSAGE = "unit_cost must be a number";
const UNIT_COST_NEGATIVE_MESSAGE = "unit_cost must be >= 0";
const UNIT_COST_DECIMALS_MESSAGE = "unit_cost must have at most 2 decimals";
const TAX_AMOUNT_MESSAGE = "tax_amount must be a number";
const TAX_AMOUNT_NEGATIVE_MESSAGE = "tax_amount must be >= 0";
const TAX_AMOUNT_DECIMALS_MESSAGE = "tax_amount must have at most 2 decimals";
const TAX_AMOUNT_MAX_MESSAGE = "tax_amount must have at most 10 integer digits";
const TAX_AMOUNT_REQUIRED_MESSAGE = "tax_amount is required";
const NOTES_MESSAGE = "notes must have at most 1000 characters";
const LOT_NUMBER_MESSAGE = `lot_number must have between 1 and ${MAX_NUMBER_LENGTH} characters`;
const EXPIRATION_DATE_MESSAGE =
  "expiration_date must be a valid date (YYYY-MM-DD)";
const LOT_PAIR_MESSAGE = "lot_number and expiration_date are required";
const ITEMS_MESSAGE = "items must be an array";

/**
 * Builds a schema for a positive integer identifier.
 * @param {string} message - Error message for invalid values.
 * @param {boolean} [required] - Whether the field is mandatory.
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
 * Builds a decimal money schema with the documented minimum and a maximum
 * that fits DECIMAL(12,2).
 * @param {object} options - Field options.
 * @param {string} options.message - Type error message.
 * @param {string} options.minMessage - Message for values below zero.
 * @param {string} options.decimalsMessage - Message for 3+ decimals.
 * @param {string} [options.maxMessage] - Message for values above the max.
 * @returns {import("yup").NumberSchema} The monetary schema.
 */
function moneyField({
  message,
  minMessage,
  decimalsMessage,
  maxMessage = "value is too large",
}) {
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
    .typeError(message)
    .test("is-number", message, function isNumber(value) {
      if (value === undefined) {
        return true;
      }

      return (
        typeof this.originalValue === "number" ||
        (typeof this.originalValue === "string" &&
          this.originalValue.trim() !== "")
      );
    })
    .min(0, minMessage)
    .max(MAX_MONEY, maxMessage)
    .test("max-decimals", decimalsMessage, (value) =>
      value === undefined ? true : hasAtMostTwoDecimals(value),
    );
}

/**
 * Builds the notes schema. Omitted and null values are accepted; strings are
 * trimmed, blank strings become null and 1001+ characters are rejected.
 * @returns {import("yup").StringSchema} The notes schema.
 */
function notesField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError(NOTES_MESSAGE)
    .test("is-string", NOTES_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_NOTES_LENGTH, NOTES_MESSAGE)
    .nullable();
}

/**
 * Builds the quantity schema: a positive integer up to one million.
 * @returns {import("yup").NumberSchema} The quantity schema.
 */
function quantityField() {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(QUANTITY_TYPE_MESSAGE)
    .integer(QUANTITY_TYPE_MESSAGE)
    .min(1, QUANTITY_MIN_MESSAGE)
    .max(MAX_QUANTITY, QUANTITY_MAX_MESSAGE)
    .required(QUANTITY_TYPE_MESSAGE);
}

/**
 * Builds the unit cost schema: a non-negative number with at most two
 * decimals.
 * @returns {import("yup").NumberSchema} The unit cost schema.
 */
function unitCostField() {
  return moneyField({
    message: UNIT_COST_MESSAGE,
    minMessage: UNIT_COST_NEGATIVE_MESSAGE,
    decimalsMessage: UNIT_COST_DECIMALS_MESSAGE,
  }).required(UNIT_COST_MESSAGE);
}

/**
 * Builds the line tax schema: an absolute non-negative amount with at most two
 * decimals and ten integer digits.
 * @param {boolean} [required] - Whether the amount is mandatory.
 * @returns {import("yup").NumberSchema} The tax amount schema.
 */
function taxAmountField(required = true) {
  const schema = moneyField({
    message: TAX_AMOUNT_MESSAGE,
    minMessage: TAX_AMOUNT_NEGATIVE_MESSAGE,
    decimalsMessage: TAX_AMOUNT_DECIMALS_MESSAGE,
    maxMessage: TAX_AMOUNT_MAX_MESSAGE,
  });

  return required ? schema.required(TAX_AMOUNT_REQUIRED_MESSAGE) : schema;
}

/**
 * Builds the trimmed lot number schema.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The lot number schema.
 */
function lotNumberField(required = false) {
  const schema = yup
    .string()
    .trim()
    .typeError(LOT_NUMBER_MESSAGE)
    .min(1, LOT_NUMBER_MESSAGE)
    .max(MAX_NUMBER_LENGTH, LOT_NUMBER_MESSAGE);

  return required ? schema.required(LOT_NUMBER_MESSAGE) : schema;
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

const purchaseItemSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE),
  quantity: quantityField(),
  unit_cost: unitCostField(),
  tax_amount: taxAmountField(),
  lot_number: lotNumberField(true),
  expiration_date: expirationDateField(true),
});

const createPurchaseSchema = yup.object({
  supplier_id: positiveInteger(SUPPLIER_ID_MESSAGE),
  currency_id: positiveInteger(CURRENCY_ID_MESSAGE, false),
  notes: notesField(),
  items: yup
    .array()
    .of(purchaseItemSchema)
    .typeError(ITEMS_MESSAGE)
    .default([]),
});

const updatePurchaseSchema = yup.object({
  supplier_id: positiveInteger(SUPPLIER_ID_MESSAGE, false),
  currency_id: positiveInteger(CURRENCY_ID_MESSAGE, false),
  notes: notesField(),
});

const createPurchaseItemSchema = purchaseItemSchema;

const updatePurchaseItemSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE, false),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE, false),
  quantity: quantityField().notRequired(),
  unit_cost: unitCostField().notRequired(),
  tax_amount: taxAmountField(false),
  lot_number: lotNumberField(),
  expiration_date: expirationDateField(),
});

module.exports = {
  CURRENCY_ID_MESSAGE,
  EDITABLE_PURCHASE_FIELDS,
  EDITABLE_PURCHASE_ITEM_FIELDS,
  EXPIRATION_DATE_MESSAGE,
  ITEMS_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  LOT_NUMBER_MESSAGE,
  LOT_PAIR_MESSAGE,
  MAX_MONEY,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
  NOTES_MESSAGE,
  PRODUCT_ID_MESSAGE,
  QUANTITY_MAX_MESSAGE,
  QUANTITY_MIN_MESSAGE,
  QUANTITY_TYPE_MESSAGE,
  REQUIRED_PURCHASE_FIELDS,
  REQUIRED_PURCHASE_ITEM_FIELDS,
  SUPPLIER_ID_MESSAGE,
  TAX_AMOUNT_DECIMALS_MESSAGE,
  TAX_AMOUNT_MAX_MESSAGE,
  TAX_AMOUNT_MESSAGE,
  TAX_AMOUNT_NEGATIVE_MESSAGE,
  TAX_AMOUNT_REQUIRED_MESSAGE,
  UNIT_COST_DECIMALS_MESSAGE,
  UNIT_COST_MESSAGE,
  UNIT_COST_NEGATIVE_MESSAGE,
  createPurchaseItemSchema,
  createPurchaseSchema,
  updatePurchaseItemSchema,
  updatePurchaseSchema,
};
