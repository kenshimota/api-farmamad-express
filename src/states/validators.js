const yup = require("yup");

const REQUIRED_STATE_FIELDS = ["name", "code"];
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_CODE_LENGTH = 2;
const MAX_CODE_LENGTH = 10;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const NAME_MESSAGE = "Nombre inválido";
const CODE_MESSAGE = "Código inválido";

/**
 * Builds a trimmed string schema with the documented length limits that
 * rejects non-string values without crashing on the trim transform.
 * @param {string} message - Error message for invalid values.
 * @param {number} minLength - Minimum accepted length.
 * @param {number} maxLength - Maximum accepted length.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message, minLength, maxLength) {
  return yup
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
}

/**
 * Builds the trimmed and uppercased ISO code schema.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The code schema.
 */
function codeField(message) {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return "";
      }

      return typeof value === "string" ? value.trim().toUpperCase() : value;
    })
    .typeError(message)
    .test("is-string", message, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(MIN_CODE_LENGTH, message)
    .max(MAX_CODE_LENGTH, message)
    .matches(/^\S+$/, message);
}

const stateSchema = yup.object({
  name: trimmedString(NAME_MESSAGE, MIN_NAME_LENGTH, MAX_NAME_LENGTH),
  code: codeField(CODE_MESSAGE),
});

/**
 * Parses a state id coming from a route parameter. Only positive integers are
 * accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseStateId(value) {
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

module.exports = {
  CODE_MESSAGE,
  MAX_CODE_LENGTH,
  MAX_NAME_LENGTH,
  MIN_CODE_LENGTH,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  parseStateId,
  REQUIRED_STATE_FIELDS,
  stateSchema,
};
