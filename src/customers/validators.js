const yup = require("yup");

const REQUIRED_CUSTOMER_FIELDS = [
  "fullName",
  "latitude",
  "longitude",
  "direction",
  "email",
];
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

/**
 * Builds a trimmed string schema that rejects blank values and non-string
 * values without crashing on the trim transform.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message) {
  return yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .matches(/\S/, message);
}

/**
 * Builds a coordinate schema bounded to the given range.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The coordinate schema.
 */
function coordinate(min, max, message) {
  return yup.number().typeError(message).min(min, message).max(max, message);
}

const createCustomerSchema = yup.object({
  fullName: trimmedString("Nombre inválido"),
  latitude: coordinate(-90, 90, "Latitud inválida"),
  longitude: coordinate(-180, 180, "Longitud inválida"),
  direction: trimmedString("Dirección inválida"),
  email: trimmedString("Email inválido").email("Email inválido"),
  isRegistered: yup
    .boolean()
    .strict()
    .typeError("isRegistered must be a boolean"),
});

/**
 * Parses a customer id coming from a route parameter. Only positive integers
 * are accepted; anything else (decimals, negatives, non numeric values) is
 * reported as null so the caller can answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseCustomerId(value) {
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
  createCustomerSchema,
  parseCustomerId,
  REQUIRED_CUSTOMER_FIELDS,
};
