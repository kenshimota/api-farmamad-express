const yup = require("yup");

const REQUIRED_IMAGE_FIELDS = ["url", "reference", "thumbnail"];
const MAX_URL_LENGTH = 2048;
const MAX_PATHNAME_LENGTH = 2048;
const MAX_REFERENCE_LENGTH = 100;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const URL_MESSAGE = "URL inválida";
const REFERENCE_MESSAGE = "Referencia inválida";
const THUMBNAIL_MESSAGE = "Miniatura inválida";
const PATHNAME_MESSAGE = "Ruta inválida";

/**
 * Builds a schema for a required URL that rejects non-string values without
 * crashing on the validation pipeline.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The URL schema.
 */
function urlField(message) {
  return yup
    .string()
    .typeError(message)
    .test("is-string", message, function isString() {
      return typeof this.originalValue === "string";
    })
    .max(MAX_URL_LENGTH, message)
    .url(message);
}

/**
 * Builds a trimmed string schema that rejects blank values and values longer
 * than the documented limit.
 * @param {string} message - Error message for invalid values.
 * @param {number} maxLength - Maximum accepted length.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message, maxLength) {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .test("is-string", message, function isString() {
      return typeof this.originalValue === "string";
    })
    .max(maxLength, message)
    .matches(/\S/, message);
}

/**
 * Builds the optional pathname schema: absent or null values become null while
 * present values are trimmed and validated as non-empty paths.
 * @returns {import("yup").StringSchema} The pathname schema.
 */
function pathnameField() {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(PATHNAME_MESSAGE)
    .test("is-string", PATHNAME_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_PATHNAME_LENGTH, PATHNAME_MESSAGE)
    .matches(/\S/, PATHNAME_MESSAGE)
    .nullable()
    .default(null);
}

const imageSchema = yup.object({
  url: urlField(URL_MESSAGE),
  pathname: pathnameField(),
  reference: trimmedString(REFERENCE_MESSAGE, MAX_REFERENCE_LENGTH),
  thumbnail: urlField(THUMBNAIL_MESSAGE),
});

/**
 * Parses an image id coming from a route parameter. Only positive integers are
 * accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseImageId(value) {
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
  imageSchema,
  MAX_PATHNAME_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_URL_LENGTH,
  parseImageId,
  REQUIRED_IMAGE_FIELDS,
};
