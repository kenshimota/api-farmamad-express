const yup = require("yup");
const { MAX_MONEY, hasAtMostTwoDecimals } = require("./money");

const REQUIRED_PURCHASE_FIELDS = ["supplier_id"];
const EDITABLE_PURCHASE_FIELDS = [
  "supplier_id",
  "currency_id",
  "tax_rate",
  "notes",
];
const REQUIRED_PURCHASE_ITEM_FIELDS = [
  "product_id",
  "item_state_id",
  "quantity",
  "unit_cost",
];
const EDITABLE_PURCHASE_ITEM_FIELDS = [...REQUIRED_PURCHASE_ITEM_FIELDS];
const MAX_NOTES_LENGTH = 1000;
const MAX_QUANTITY = 1000000;
const DEFAULT_TAX_RATE = 16;
const MAX_TAX_RATE = 100;
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
const TAX_RATE_MESSAGE = "tax_rate must be a number";
const TAX_RATE_MIN_MESSAGE = "tax_rate must be >= 0";
const TAX_RATE_MAX_MESSAGE = "tax_rate must be <= 100";
const TAX_RATE_DECIMALS_MESSAGE = "tax_rate must have at most 2 decimals";
const NOTES_MESSAGE = "notes must have at most 1000 characters";
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
 * @returns {import("yup").NumberSchema} The monetary schema.
 */
function moneyField({ message, minMessage, decimalsMessage }) {
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
    .max(MAX_MONEY, "value is too large")
    .test("max-decimals", decimalsMessage, (value) =>
      value === undefined ? true : hasAtMostTwoDecimals(value),
    );
}

/**
 * Builds the optional tax rate schema: a number between 0 and 100 with at most
 * two decimals.
 * @returns {import("yup").NumberSchema} The tax rate schema.
 */
function taxRateField() {
  return moneyField({
    message: TAX_RATE_MESSAGE,
    minMessage: TAX_RATE_MIN_MESSAGE,
    decimalsMessage: TAX_RATE_DECIMALS_MESSAGE,
  })
    .max(MAX_TAX_RATE, TAX_RATE_MAX_MESSAGE)
    .test(
      "tax-rate-min",
      TAX_RATE_MIN_MESSAGE,
      (value) => value === undefined || value >= 0,
    );
}

/**
 * Builds the optional notes schema. Omitted and null values are accepted;
 * strings are trimmed, blank strings become null and 1001+ characters are
 * rejected.
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

const purchaseItemSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE),
  quantity: quantityField(),
  unit_cost: unitCostField(),
});

const createPurchaseSchema = yup.object({
  supplier_id: positiveInteger(SUPPLIER_ID_MESSAGE),
  currency_id: positiveInteger(CURRENCY_ID_MESSAGE, false),
  tax_rate: taxRateField(),
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
  tax_rate: taxRateField(),
  notes: notesField(),
});

const createPurchaseItemSchema = purchaseItemSchema;

const updatePurchaseItemSchema = yup.object({
  product_id: positiveInteger(PRODUCT_ID_MESSAGE, false),
  item_state_id: positiveInteger(ITEM_STATE_ID_MESSAGE, false),
  quantity: quantityField().notRequired(),
  unit_cost: unitCostField().notRequired(),
});

/**
 * Resolves the default tax rate from `PURCHASE_TAX_RATE`, falling back to 16
 * when the variable is absent or invalid.
 * @returns {number} The tax rate between 0 and 100.
 */
function resolveDefaultTaxRate() {
  const raw = process.env.PURCHASE_TAX_RATE;

  if (raw === undefined || raw === "") {
    return DEFAULT_TAX_RATE;
  }

  const value = Number(raw);

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_TAX_RATE ||
    !hasAtMostTwoDecimals(value)
  ) {
    return DEFAULT_TAX_RATE;
  }

  return value;
}

module.exports = {
  CURRENCY_ID_MESSAGE,
  DEFAULT_TAX_RATE,
  EDITABLE_PURCHASE_FIELDS,
  EDITABLE_PURCHASE_ITEM_FIELDS,
  ITEMS_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
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
  TAX_RATE_DECIMALS_MESSAGE,
  TAX_RATE_MAX_MESSAGE,
  TAX_RATE_MESSAGE,
  TAX_RATE_MIN_MESSAGE,
  UNIT_COST_DECIMALS_MESSAGE,
  UNIT_COST_MESSAGE,
  UNIT_COST_NEGATIVE_MESSAGE,
  createPurchaseItemSchema,
  createPurchaseSchema,
  resolveDefaultTaxRate,
  updatePurchaseItemSchema,
  updatePurchaseSchema,
};
