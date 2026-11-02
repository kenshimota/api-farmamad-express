const yup = require("yup");

const REQUIRED_PRODUCT_FIELDS = [
  "name",
  "description",
  "reference",
  "category_id",
];
const NUMERIC_PRODUCT_FIELDS = Object.freeze(["category_id", "image_id"]);
const MAX_NAME_LENGTH = 150;
const MAX_REFERENCE_LENGTH = 100;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const NAME_MESSAGE = "Nombre inválido";
const DESCRIPTION_MESSAGE = "Descripción inválida";
const REFERENCE_MESSAGE = "Referencia inválida";
const CATEGORY_ID_MESSAGE = "Invalid category id";
const IMAGE_ID_MESSAGE = "Invalid image id";
const IMAGE_REQUIRED_MESSAGE = "image or image_id is required";
const IMAGE_ID_EXCLUSIVE_MESSAGE = "image_id cannot be combined with image";

/**
 * Builds a trimmed string schema that rejects blank values and, when a limit
 * is provided, values longer than the documented maximum.
 * @param {string} message - Error message for invalid values.
 * @param {number} [maxLength] - Maximum accepted length.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message, maxLength) {
  const schema = yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .test("is-string", message, function isString() {
      return typeof this.originalValue === "string";
    })
    .matches(/\S/, message);

  return maxLength === undefined ? schema : schema.max(maxLength, message);
}

/**
 * Builds a schema for a required positive integer identifier.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function positiveInteger(message) {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message)
    .required(message);
}

const productSchema = yup.object({
  name: trimmedString(NAME_MESSAGE, MAX_NAME_LENGTH),
  description: trimmedString(DESCRIPTION_MESSAGE),
  reference: trimmedString(REFERENCE_MESSAGE, MAX_REFERENCE_LENGTH),
  category_id: positiveInteger(CATEGORY_ID_MESSAGE),
  image_id: positiveInteger(IMAGE_ID_MESSAGE).optional(),
});

/**
 * Converts the numeric fields that arrive as text in `multipart/form-data`
 * before yup validates them. Values that are not plain digits are left intact
 * so the schema still reports them as invalid.
 * @param {object} [body] - Raw request body.
 * @returns {object} A copy with numeric fields converted when possible.
 */
function normalizeProductBody(body = {}) {
  const normalized = { ...body };

  for (const field of NUMERIC_PRODUCT_FIELDS) {
    const value = normalized[field];

    if (
      typeof value === "string" &&
      POSITIVE_INTEGER_PATTERN.test(value.trim())
    ) {
      normalized[field] = Number(value.trim());
    }
  }

  return normalized;
}

/**
 * Parses a product id coming from a route parameter. Only positive integers
 * are accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseProductId(value) {
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
  CATEGORY_ID_MESSAGE,
  IMAGE_ID_EXCLUSIVE_MESSAGE,
  IMAGE_ID_MESSAGE,
  IMAGE_REQUIRED_MESSAGE,
  MAX_NAME_LENGTH,
  MAX_REFERENCE_LENGTH,
  normalizeProductBody,
  parseProductId,
  productSchema,
  REQUIRED_PRODUCT_FIELDS,
};
