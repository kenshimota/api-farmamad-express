const {
  DEFAULT_TEXT_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PHONE_MIN_LENGTH,
  TYPE_NORMALIZERS,
  requiredError,
  setFieldError,
} = require("./details-normalizers");

const DETAILS_OBJECT_MESSAGE = "details must be an object";
const UNKNOWN_FIELD_MESSAGE = "Unknown field";

/**
 * Tells whether a value is a plain JSON object, excluding null and arrays.
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is a plain object.
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates `details` against the field definitions of its payment type. It
 * never includes the submitted values in the error messages because they are
 * sensitive collection data.
 * @param {object[]|undefined} fields - `method_payment_types.fields`.
 * @param {unknown} details - Raw details object.
 * @returns {{ details: object, errors: Record<string, string> }} The
 *   normalized details and the field-prefixed errors.
 */
function validateDetails(fields, details) {
  if (!isPlainObject(details)) {
    return { details: {}, errors: { details: DETAILS_OBJECT_MESSAGE } };
  }

  const definitions = Array.isArray(fields) ? fields : [];
  const known = new Set(definitions.map((definition) => definition.key));
  const normalized = {};
  const errors = {};

  for (const definition of definitions) {
    const value = details[definition.key];

    if (value === undefined || value === null) {
      if (definition.required) {
        requiredError(errors, definition.key);
      }

      continue;
    }

    const normalize = TYPE_NORMALIZERS[definition.type];

    if (!normalize) {
      continue;
    }

    const result = normalize(definition, value, errors);

    if (result !== undefined) {
      normalized[definition.key] = result;
    }
  }

  for (const key of Object.keys(details)) {
    if (!known.has(key)) {
      setFieldError(errors, key, UNKNOWN_FIELD_MESSAGE);
    }
  }

  return { details: normalized, errors };
}

module.exports = {
  DEFAULT_TEXT_MAX_LENGTH,
  DETAILS_OBJECT_MESSAGE,
  EMAIL_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PHONE_MIN_LENGTH,
  UNKNOWN_FIELD_MESSAGE,
  isPlainObject,
  validateDetails,
};
