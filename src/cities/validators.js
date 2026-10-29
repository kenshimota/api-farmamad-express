const yup = require("yup");

const REQUIRED_CITY_FIELDS = ["name", "state_id"];
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const NAME_MESSAGE = "Nombre inválido";
const STATE_ID_MESSAGE = "Invalid state";

/**
 * Builds a trimmed string schema with the documented length limits that
 * rejects non-string values without crashing on the trim transform.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The string schema.
 */
function nameField(message) {
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
    .min(MIN_NAME_LENGTH, message)
    .max(MAX_NAME_LENGTH, message)
    .matches(/\S/, message);
}

/**
 * Builds a schema for a positive integer state id. It stays optional so the
 * same schema can validate partial updates; creation requires it through the
 * request validator.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function stateIdField(message) {
  return yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message);
}

const citySchema = yup.object({
  name: nameField(NAME_MESSAGE),
  state_id: stateIdField(STATE_ID_MESSAGE),
});

/**
 * Parses a city id or a state_id filter coming from the request. Only positive
 * integers are accepted; anything else is reported as null so the caller can
 * answer 422.
 * @param {unknown} value - Raw route parameter or query value.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseCityId(value) {
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
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  parseCityId,
  REQUIRED_CITY_FIELDS,
  STATE_ID_MESSAGE,
  citySchema,
};
