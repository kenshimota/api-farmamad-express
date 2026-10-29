const yup = require("yup");

const REQUIRED_SUPPLIER_FIELDS = [
  "name",
  "identification",
  "email",
  "phone",
  "address",
  "city_id",
  "state_id",
];
const EDITABLE_SUPPLIER_FIELDS = [
  "name",
  "identification",
  "email",
  "phone",
  "observations",
  "address",
  "city_id",
  "state_id",
];

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 150;
const MIN_IDENTIFICATION_LENGTH = 5;
const MAX_IDENTIFICATION_LENGTH = 30;
const MAX_EMAIL_LENGTH = 150;
const MIN_PHONE_LENGTH = 7;
const MAX_PHONE_LENGTH = 30;
const MAX_OBSERVATIONS_LENGTH = 1000;
const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 255;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const NAME_MESSAGE = "Nombre inválido";
const IDENTIFICATION_MESSAGE = "Identificación inválida";
const EMAIL_MESSAGE = "Email inválido";
const PHONE_MESSAGE = "Teléfono inválido";
const OBSERVATIONS_MESSAGE = "Observaciones inválidas";
const ADDRESS_MESSAGE = "Dirección inválida";
const CITY_ID_MESSAGE = "Invalid city id";
const STATE_ID_MESSAGE = "Invalid state";
const LOCATION_MESSAGE = "City does not belong to state";

/**
 * Builds a trimmed string schema with the documented limits that rejects
 * non-string values without crashing on the trim transform.
 * @param {object} options - Field options.
 * @param {string} options.message - Error message for invalid values.
 * @param {number} options.min - Minimum accepted length.
 * @param {number} options.max - Maximum accepted length.
 * @param {RegExp} [options.pattern] - Allowed characters pattern.
 * @param {function(string): string} [options.normalize] - Extra transform.
 * @returns {import("yup").StringSchema} The string schema.
 */
function stringField({ message, min, max, pattern, normalize }) {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return "";
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return normalize ? normalize(trimmed) : trimmed;
    })
    .typeError(message)
    .test("is-string", message, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(min, message)
    .max(max, message)
    .matches(pattern ?? /\S/, message);
}

/**
 * Builds the required, trimmed and lowercased email schema.
 * @returns {import("yup").StringSchema} The email schema.
 */
function emailField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return "";
      }

      return typeof value === "string" ? value.trim().toLowerCase() : value;
    })
    .typeError(EMAIL_MESSAGE)
    .test("is-string", EMAIL_MESSAGE, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .max(MAX_EMAIL_LENGTH, EMAIL_MESSAGE)
    .email(EMAIL_MESSAGE);
}

/**
 * Builds the optional observations schema. Null and omitted values are
 * accepted; strings are trimmed and any other type is rejected.
 * @returns {import("yup").StringSchema} The observations schema.
 */
function observationsField() {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return null;
      }

      return typeof value === "string" ? value.trim() : value;
    })
    .typeError(OBSERVATIONS_MESSAGE)
    .max(MAX_OBSERVATIONS_LENGTH, OBSERVATIONS_MESSAGE)
    .nullable();
}

/**
 * Builds a schema for a positive integer identifier. It stays optional so the
 * same schema can validate partial updates; creation requires it through the
 * request validator.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function positiveInteger(message) {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message);
}

const supplierSchema = yup.object({
  name: stringField({
    message: NAME_MESSAGE,
    min: MIN_NAME_LENGTH,
    max: MAX_NAME_LENGTH,
  }),
  identification: stringField({
    message: IDENTIFICATION_MESSAGE,
    min: MIN_IDENTIFICATION_LENGTH,
    max: MAX_IDENTIFICATION_LENGTH,
    pattern: /^[A-Z0-9.-]+$/,
    normalize: (value) => value.toUpperCase(),
  }),
  email: emailField(),
  phone: stringField({
    message: PHONE_MESSAGE,
    min: MIN_PHONE_LENGTH,
    max: MAX_PHONE_LENGTH,
    pattern: /^[0-9+()\s-]+$/,
  }),
  observations: observationsField(),
  address: stringField({
    message: ADDRESS_MESSAGE,
    min: MIN_ADDRESS_LENGTH,
    max: MAX_ADDRESS_LENGTH,
  }),
  city_id: positiveInteger(CITY_ID_MESSAGE),
  state_id: positiveInteger(STATE_ID_MESSAGE),
});

/**
 * Parses a supplier id coming from a route parameter or a query filter. Only
 * positive integers are accepted; anything else is reported as null so the
 * caller can answer 422.
 * @param {unknown} value - Raw route parameter or query value.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseSupplierId(value) {
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
  ADDRESS_MESSAGE,
  CITY_ID_MESSAGE,
  EDITABLE_SUPPLIER_FIELDS,
  EMAIL_MESSAGE,
  IDENTIFICATION_MESSAGE,
  LOCATION_MESSAGE,
  MAX_ADDRESS_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_IDENTIFICATION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_OBSERVATIONS_LENGTH,
  MAX_PHONE_LENGTH,
  MIN_ADDRESS_LENGTH,
  MIN_IDENTIFICATION_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PHONE_LENGTH,
  NAME_MESSAGE,
  OBSERVATIONS_MESSAGE,
  PHONE_MESSAGE,
  parseSupplierId,
  REQUIRED_SUPPLIER_FIELDS,
  STATE_ID_MESSAGE,
  supplierSchema,
};
