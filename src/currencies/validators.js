const yup = require("yup");

const REQUIRED_CURRENCY_FIELDS = Object.freeze([
  "code",
  "name",
  "symbol",
  "rate",
]);
const UPDATE_CURRENCY_FIELDS = Object.freeze([
  "name",
  "symbol",
  "rate",
  "is_active",
  "reason",
]);
const CODE_PATTERN = /^[A-Z0-9_]{2,10}$/;
const MAX_NAME_LENGTH = 100;
const MIN_NAME_LENGTH = 2;
const MAX_SYMBOL_LENGTH = 10;
const MAX_REASON_LENGTH = 255;
const MAX_RATE = 999999999999;

const CODE_MESSAGE = "code must match ^[A-Z0-9_]{2,10}$";
const NAME_MESSAGE = "name must be between 2 and 100 characters";
const SYMBOL_MESSAGE = "symbol must be between 1 and 10 characters";
const RATE_MESSAGE = "rate must be a number";
const RATE_POSITIVE_MESSAGE = "rate must be greater than 0";
const RATE_DECIMALS_MESSAGE = "rate must have at most 6 decimals";
const RATE_MAX_MESSAGE = "rate must be at most 999999999999";
const IS_ACTIVE_MESSAGE = "is_active must be a boolean";
const REASON_MESSAGE = "reason must have at most 255 characters";
const INCLUDE_INACTIVE_MESSAGE = "Invalid include_inactive";

/**
 * Tells whether a numeric value has at most six decimal places, allowing for
 * the usual binary floating point representation error.
 * @param {number} value - Numeric value already cast by yup.
 * @returns {boolean} True when the value fits DECIMAL(18,6) decimals.
 */
function hasAtMostSixDecimals(value) {
  if (!Number.isFinite(value)) {
    return false;
  }

  const scaled = value * 1000000;
  const tolerance = Number.EPSILON * Math.abs(scaled) * 4;

  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

/**
 * Builds the trimmed, uppercase code schema. The code is the stable key and
 * matches `^[A-Z0-9_]{2,10}$`.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The code schema.
 */
function codeField(required = false) {
  const schema = yup
    .string()
    .transform((value) =>
      typeof value === "string" ? value.trim().toUpperCase() : value,
    )
    .typeError(CODE_MESSAGE)
    .test("is-string", CODE_MESSAGE, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .matches(CODE_PATTERN, CODE_MESSAGE);

  return required ? schema.required(CODE_MESSAGE) : schema;
}

/**
 * Builds a trimmed string schema with the documented length limits.
 * @param {string} message - Error message for invalid values.
 * @param {number} minLength - Minimum accepted length.
 * @param {number} maxLength - Maximum accepted length.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedStringField(message, minLength, maxLength, required = false) {
  const schema = yup
    .string()
    .transform((value) => {
      if (value === null) {
        return "";
      }

      return typeof value === "string" ? value.trim() : value;
    })
    .typeError(message)
    .test("is-string", message, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(minLength, message)
    .max(maxLength, message)
    .matches(/\S/, message);

  return required ? schema.required(message) : schema;
}

/**
 * Builds the rate schema: a positive number with at most six decimals and
 * twelve integer digits, matching DECIMAL(18,6).
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The rate schema.
 */
function rateField(required = false) {
  const schema = yup
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
    .typeError(RATE_MESSAGE)
    .test("is-number", RATE_MESSAGE, function isNumber(value) {
      if (value === undefined) {
        return true;
      }

      return (
        typeof this.originalValue === "number" ||
        (typeof this.originalValue === "string" &&
          this.originalValue.trim() !== "")
      );
    })
    .test(
      "positive",
      RATE_POSITIVE_MESSAGE,
      (value) => value === undefined || value > 0,
    )
    .max(MAX_RATE, RATE_MAX_MESSAGE)
    .test("max-decimals", RATE_DECIMALS_MESSAGE, (value) =>
      value === undefined ? true : hasAtMostSixDecimals(value),
    );

  return required ? schema.required(RATE_MESSAGE) : schema;
}

/**
 * Builds the strict boolean schema used by `is_active`, so text and numeric
 * representations are rejected instead of silently cast.
 * @returns {import("yup").BooleanSchema} The boolean schema.
 */
function isActiveField() {
  return yup
    .boolean()
    .typeError(IS_ACTIVE_MESSAGE)
    .test("is-boolean", IS_ACTIVE_MESSAGE, function isBoolean(value) {
      return (
        value === undefined ||
        this.originalValue === undefined ||
        typeof this.originalValue === "boolean"
      );
    });
}

/**
 * Builds the optional reason schema. Omitted and null values are accepted,
 * strings are trimmed, blank strings become null and 256+ characters are
 * rejected.
 * @returns {import("yup").StringSchema} The reason schema.
 */
function reasonField() {
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
    .typeError(REASON_MESSAGE)
    .test("is-string", REASON_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_REASON_LENGTH, REASON_MESSAGE)
    .nullable();
}

const createCurrencySchema = yup.object({
  code: codeField(true),
  name: trimmedStringField(
    NAME_MESSAGE,
    MIN_NAME_LENGTH,
    MAX_NAME_LENGTH,
    true,
  ),
  symbol: trimmedStringField(SYMBOL_MESSAGE, 1, MAX_SYMBOL_LENGTH, true),
  rate: rateField(true),
});

const updateCurrencySchema = yup.object({
  name: trimmedStringField(NAME_MESSAGE, MIN_NAME_LENGTH, MAX_NAME_LENGTH),
  symbol: trimmedStringField(SYMBOL_MESSAGE, 1, MAX_SYMBOL_LENGTH),
  rate: rateField(),
  is_active: isActiveField(),
  reason: reasonField(),
});

module.exports = {
  CODE_MESSAGE,
  INCLUDE_INACTIVE_MESSAGE,
  IS_ACTIVE_MESSAGE,
  MAX_NAME_LENGTH,
  MAX_RATE,
  MAX_REASON_LENGTH,
  MAX_SYMBOL_LENGTH,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  RATE_DECIMALS_MESSAGE,
  RATE_MAX_MESSAGE,
  RATE_MESSAGE,
  RATE_POSITIVE_MESSAGE,
  REASON_MESSAGE,
  REQUIRED_CURRENCY_FIELDS,
  SYMBOL_MESSAGE,
  UPDATE_CURRENCY_FIELDS,
  createCurrencySchema,
  hasAtMostSixDecimals,
  updateCurrencySchema,
};
