const yup = require("yup");

const REQUIRED_CUSTOMER_FIELDS = [
  "fullName",
  "latitude",
  "longitude",
  "direction",
  "email",
];
const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const PRICE_LIST_ID_MESSAGE = "Invalid price list";
const PAYMENT_TERM_ID_MESSAGE = "Invalid payment term";

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

/**
 * Builds the optional price list reference schema. `null` clears the
 * assignment, a positive integer replaces it and an omitted value keeps the
 * stored one on updates.
 * @returns {import("yup").NumberSchema} The nullable price list id schema.
 */
function priceListIdField() {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (originalValue === null || originalValue === undefined) {
        return originalValue;
      }

      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .nullable()
    .integer(PRICE_LIST_ID_MESSAGE)
    .min(1, PRICE_LIST_ID_MESSAGE)
    .typeError(PRICE_LIST_ID_MESSAGE);
}

/**
 * Builds the optional payment term reference schema. `null` clears the
 * assignment, a positive integer replaces it and an omitted value keeps the
 * stored one on updates.
 * @returns {import("yup").NumberSchema} The nullable payment term id schema.
 */
function paymentTermIdField() {
  return yup
    .number()
    .transform((value, originalValue) => {
      if (originalValue === null || originalValue === undefined) {
        return originalValue;
      }

      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .nullable()
    .integer(PAYMENT_TERM_ID_MESSAGE)
    .min(1, PAYMENT_TERM_ID_MESSAGE)
    .typeError(PAYMENT_TERM_ID_MESSAGE);
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
  price_list_id: priceListIdField(),
  payment_term_id: paymentTermIdField(),
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
  PAYMENT_TERM_ID_MESSAGE,
  PRICE_LIST_ID_MESSAGE,
  createCustomerSchema,
  parseCustomerId,
  REQUIRED_CUSTOMER_FIELDS,
};
