const yup = require("yup");
const { REQUIRED_TAX_FIELDS, UPDATE_TAX_FIELDS } = require("./fields");

const CODE_PATTERN = /^[A-Z0-9_]{2,20}$/;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 255;
const MIN_RATE = 0;
const MAX_RATE = 100;

const CODE_MESSAGE = "code must match ^[A-Za-z0-9_]{2,20}$";
const NAME_MESSAGE = "name must be between 2 and 100 characters";
const RATE_MESSAGE = "rate must be a number";
const RATE_RANGE_MESSAGE = "rate must be between 0 and 100";
const RATE_DECIMALS_MESSAGE = "rate must have at most 2 decimals";
const DESCRIPTION_MESSAGE = "description must have at most 255 characters";
const IS_ACTIVE_MESSAGE = "is_active must be a boolean";
const IS_ACTIVE_FILTER_MESSAGE = "Invalid is_active";

/**
 * Tells whether a numeric value has at most two decimal places, allowing for
 * the usual binary floating point representation error.
 * @param {number} value - Numeric value already cast by yup.
 * @returns {boolean} True when the value fits DECIMAL(5,2) decimals.
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
 * Builds the trimmed, uppercase code schema. Codes are stable keys and match
 * `^[A-Z0-9_]{2,20}$` after normalization.
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
    .transform((value) => (typeof value === "string" ? value.trim() : value))
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
 * Builds the optional description schema. Omitted and null values are
 * accepted, strings are trimmed, blank strings become null and 256+
 * characters are rejected.
 * @returns {import("yup").StringSchema} The description schema.
 */
function descriptionField() {
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
    .typeError(DESCRIPTION_MESSAGE)
    .test("is-string", DESCRIPTION_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_DESCRIPTION_LENGTH, DESCRIPTION_MESSAGE)
    .nullable();
}

/**
 * Builds the percentage rate schema: a number between 0 and 100 with at most
 * two decimals, matching DECIMAL(5,2).
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
    .min(MIN_RATE, RATE_RANGE_MESSAGE)
    .max(MAX_RATE, RATE_RANGE_MESSAGE)
    .test("max-decimals", RATE_DECIMALS_MESSAGE, (value) =>
      value === undefined ? true : hasAtMostTwoDecimals(value),
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

const createTaxSchema = yup.object({
  code: codeField(true),
  name: trimmedStringField(
    NAME_MESSAGE,
    MIN_NAME_LENGTH,
    MAX_NAME_LENGTH,
    true,
  ),
  rate: rateField(true),
  description: descriptionField().default(null),
  is_active: isActiveField().default(true),
});

const updateTaxSchema = yup.object({
  name: trimmedStringField(NAME_MESSAGE, MIN_NAME_LENGTH, MAX_NAME_LENGTH),
  rate: rateField(),
  description: descriptionField(),
  is_active: isActiveField(),
});

module.exports = {
  CODE_MESSAGE,
  CODE_PATTERN,
  DESCRIPTION_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  IS_ACTIVE_MESSAGE,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_RATE,
  MIN_NAME_LENGTH,
  MIN_RATE,
  NAME_MESSAGE,
  RATE_DECIMALS_MESSAGE,
  RATE_MESSAGE,
  RATE_RANGE_MESSAGE,
  REQUIRED_TAX_FIELDS,
  UPDATE_TAX_FIELDS,
  createTaxSchema,
  hasAtMostTwoDecimals,
  updateTaxSchema,
};
