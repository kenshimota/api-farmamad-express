const yup = require("yup");

const CUSTOMER_ID_MESSAGE = "customer_id must be a positive integer";
const METHOD_PAYMENT_ID_MESSAGE =
  "method_payment_id must be a positive integer";
const CURRENCY_ID_MESSAGE = "currency_id must be a positive integer";
const AMOUNT_MESSAGE = "amount must be a positive number with two decimals";
const PAID_AT_MESSAGE = "paid_at must be a valid date";
const REFERENCE_MESSAGE = "reference must be at most 100 characters";
const NOTES_MESSAGE = "notes must be at most 1000 characters";

/**
 * Builds a required positive integer schema for ids.
 * @param {string} message - Error message.
 * @returns {import("yup").NumberSchema} The id schema.
 */
function idField(message) {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(message)
    .test("is-integer-string", message, function isInteger(value) {
      if (value === undefined) {
        return true;
      }

      if (typeof this.originalValue === "number") {
        return Number.isInteger(this.originalValue);
      }

      return (
        typeof this.originalValue === "string" &&
        /^\d+$/.test(this.originalValue.trim())
      );
    })
    .integer(message)
    .positive(message);
}

/**
 * Checks that a numeric amount has at most two decimals.
 * @param {unknown} value - Parsed number.
 * @param {unknown} originalValue - Raw input value.
 * @returns {boolean} True when the amount is valid.
 */
function hasAtMostTwoDecimals(value, originalValue) {
  if (value === undefined) {
    return true;
  }

  if (typeof originalValue === "number") {
    return (
      Number.isFinite(originalValue) &&
      Number(originalValue.toFixed(2)) === originalValue
    );
  }

  if (typeof originalValue !== "string") {
    return false;
  }

  return /^\d+(\.\d{1,2})?$/.test(originalValue.trim());
}

/**
 * Builds the amount schema: positive, finite and with at most two decimals.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The amount schema.
 */
function amountField(required = false) {
  const schema = yup
    .number()
    .transform((value, originalValue) => {
      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(AMOUNT_MESSAGE)
    .positive(AMOUNT_MESSAGE)
    .test("two-decimals", AMOUNT_MESSAGE, function validateDecimals(value) {
      return hasAtMostTwoDecimals(value, this.originalValue);
    });

  return required ? schema.required(AMOUNT_MESSAGE) : schema;
}

/**
 * Builds an optional trimmed text field that stores an empty string as null.
 * @param {number} max - Maximum length.
 * @param {string} message - Error message.
 * @returns {import("yup").StringSchema} The text schema.
 */
function optionalText(max, message) {
  return yup
    .string()
    .transform((value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError(message)
    .nullable()
    .max(max, message);
}

/**
 * Builds the optional `paid_at` schema.
 * @returns {import("yup").DateSchema} The date schema.
 */
function paidAtField() {
  return yup.date().typeError(PAID_AT_MESSAGE);
}

const createPaymentSchema = yup.object({
  customer_id: idField(CUSTOMER_ID_MESSAGE).required(),
  method_payment_id: idField(METHOD_PAYMENT_ID_MESSAGE).required(),
  amount: amountField(true),
  paid_at: paidAtField(),
  reference: optionalText(100, REFERENCE_MESSAGE),
  notes: optionalText(1000, NOTES_MESSAGE),
});

const updatePaymentSchema = yup.object({
  customer_id: idField(CUSTOMER_ID_MESSAGE),
  method_payment_id: idField(METHOD_PAYMENT_ID_MESSAGE),
  currency_id: idField(CURRENCY_ID_MESSAGE),
  amount: amountField(),
  paid_at: paidAtField(),
  reference: optionalText(100, REFERENCE_MESSAGE),
  notes: optionalText(1000, NOTES_MESSAGE),
});

/**
 * Parses a `YYYY-MM-DD` query value into a UTC date.
 * @param {unknown} value - Raw query value.
 * @returns {Date|null} The parsed date or null when invalid.
 */
function parseDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10) === trimmed ? date : null;
}

/**
 * Adds whole days to a UTC date.
 * @param {Date} date - Base date.
 * @param {number} days - Days to add.
 * @returns {Date} The shifted date.
 */
function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

module.exports = {
  AMOUNT_MESSAGE,
  CURRENCY_ID_MESSAGE,
  CUSTOMER_ID_MESSAGE,
  METHOD_PAYMENT_ID_MESSAGE,
  NOTES_MESSAGE,
  PAID_AT_MESSAGE,
  REFERENCE_MESSAGE,
  addDays,
  amountField,
  createPaymentSchema,
  hasAtMostTwoDecimals,
  idField,
  optionalText,
  paidAtField,
  parseDateOnly,
  updatePaymentSchema,
};
