const yup = require("yup");
const {
  REQUIRED_PAYMENT_TERM_FIELDS,
  UPDATE_PAYMENT_TERM_FIELDS,
} = require("./fields");

const CODE_PATTERN = /^[a-z][a-z0-9_]{1,29}$/;
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 255;
const MIN_DAYS = 0;
const MAX_DAYS = 3650;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const CODE_MESSAGE = "code must match ^[a-z][a-z0-9_]{1,29}$";
const NAME_MESSAGE = "name must be between 1 and 100 characters";
const DESCRIPTION_MESSAGE = "description must have at most 255 characters";
const DAYS_MESSAGE = "days must be an integer";
const DAYS_RANGE_MESSAGE = "days must be between 0 and 3650";
const IS_ACTIVE_MESSAGE = "is_active must be a boolean";
const IS_ACTIVE_FILTER_MESSAGE = "Invalid is_active";

/**
 * Builds the trimmed, lowercase code schema.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The code schema.
 */
function codeField(required = false) {
  const schema = yup
    .string()
    .transform((value) =>
      typeof value === "string" ? value.trim().toLowerCase() : value,
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
 * @param {string} message - Error message.
 * @param {number} min - Minimum length.
 * @param {number} max - Maximum length.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedStringField(message, min, max, required = false) {
  const schema = yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .test("is-string", message, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(min, message)
    .max(max, message)
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
 * Builds the days schema: an integer between 0 (cash) and 3650.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The days schema.
 */
function daysField(required = false) {
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
    .typeError(DAYS_MESSAGE)
    .test("is-number", DAYS_MESSAGE, function isNumber(value) {
      if (value === undefined) {
        return true;
      }

      return (
        typeof this.originalValue === "number" ||
        (typeof this.originalValue === "string" &&
          this.originalValue.trim() !== "")
      );
    })
    .integer(DAYS_MESSAGE)
    .min(MIN_DAYS, DAYS_RANGE_MESSAGE)
    .max(MAX_DAYS, DAYS_RANGE_MESSAGE);

  return required ? schema.required(DAYS_MESSAGE) : schema;
}

/**
 * Builds the strict boolean schema used by `is_active`.
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

const createPaymentTermSchema = yup.object({
  code: codeField(true),
  name: trimmedStringField(
    NAME_MESSAGE,
    MIN_NAME_LENGTH,
    MAX_NAME_LENGTH,
    true,
  ),
  description: descriptionField().default(null),
  days: daysField(true),
  is_active: isActiveField().default(true),
});

const updatePaymentTermSchema = yup.object({
  name: trimmedStringField(NAME_MESSAGE, MIN_NAME_LENGTH, MAX_NAME_LENGTH),
  description: descriptionField(),
  days: daysField(),
  is_active: isActiveField(),
});

/**
 * Parses a payment term id coming from a route parameter.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parsePaymentTermId(value) {
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
 * Parses a boolean query flag. Only `true` and `false` (also as strings) are
 * accepted; anything else resolves to undefined so the caller can answer 422.
 * @param {unknown} value - Raw query value.
 * @returns {boolean|undefined} The parsed flag or undefined when invalid.
 */
function parseBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return undefined;
}

module.exports = {
  CODE_MESSAGE,
  CODE_PATTERN,
  DAYS_MESSAGE,
  DAYS_RANGE_MESSAGE,
  DESCRIPTION_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  IS_ACTIVE_MESSAGE,
  MAX_DAYS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MIN_DAYS,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  REQUIRED_PAYMENT_TERM_FIELDS,
  UPDATE_PAYMENT_TERM_FIELDS,
  createPaymentTermSchema,
  parseBooleanFlag,
  parsePaymentTermId,
  updatePaymentTermSchema,
};
