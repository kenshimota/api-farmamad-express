const yup = require("yup");

const REQUIRED_CATEGORY_FIELDS = ["name"];
const MAX_NAME_LENGTH = 100;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

/**
 * Builds a trimmed string schema that rejects blank values, values longer than
 * the documented limit and non-string values without crashing on the trim
 * transform.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message) {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .test("is-string", message, function isString() {
      return typeof this.originalValue === "string";
    })
    .max(MAX_NAME_LENGTH, message)
    .matches(/\S/, message);
}

const categorySchema = yup.object({
  name: trimmedString("Nombre inválido"),
});

/**
 * Parses a category id coming from a route parameter. Only positive integers
 * are accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseCategoryId(value) {
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
  categorySchema,
  MAX_NAME_LENGTH,
  parseCategoryId,
  REQUIRED_CATEGORY_FIELDS,
};
