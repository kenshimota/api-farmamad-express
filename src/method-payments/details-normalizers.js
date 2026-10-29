const DEFAULT_TEXT_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MIN_LENGTH = 6;
const PHONE_MAX_LENGTH = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\s-]+$/;
const INTEGER_PATTERN = /^[+-]?\d+$/;

/**
 * Reads the effective maximum length of a field, capped by the type limit.
 * @param {object} definition - Field definition.
 * @param {number} defaultLength - Default length for the type.
 * @param {number} cap - Hard cap for the type.
 * @returns {number} The effective maximum length.
 */
function maxLengthOf(definition, defaultLength, cap) {
  const configured = Number.isInteger(definition.max_length)
    ? definition.max_length
    : defaultLength;

  return Math.min(configured, cap);
}

/**
 * Records an error for one field, always prefixed with `details.`.
 * @param {Record<string, string>} errors - Error accumulator.
 * @param {string} key - Field key.
 * @param {string} message - Error message.
 * @returns {void}
 */
function setFieldError(errors, key, message) {
  errors[`details.${key}`] = message;
}

/**
 * Adds the documented required error for a missing or empty value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @param {string} key - Field key.
 * @returns {void}
 */
function requiredError(errors, key) {
  setFieldError(errors, key, `${key} is required`);
}

/**
 * Reads a trimmed string value, applying the required rule. It does not check
 * the length because each type applies its own cap afterwards.
 * @param {object} definition - Field definition.
 * @param {unknown} value - Raw value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @param {string} invalidMessage - Message for a non-string value.
 * @returns {string|undefined} The trimmed value or undefined when omitted.
 */
function readStringValue(definition, value, errors, invalidMessage) {
  if (typeof value !== "string") {
    setFieldError(errors, definition.key, invalidMessage);

    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    if (definition.required) {
      requiredError(errors, definition.key);
    }

    return undefined;
  }

  return trimmed;
}

/**
 * Checks the effective maximum length of a value.
 * @param {object} definition - Field definition.
 * @param {string} value - Normalized value.
 * @param {number} defaultLength - Default length for the type.
 * @param {number} cap - Hard cap for the type.
 * @param {Record<string, string>} errors - Error accumulator.
 * @returns {boolean} True when the value fits in the maximum length.
 */
function fitsMaxLength(definition, value, defaultLength, cap, errors) {
  const maxLength = maxLengthOf(definition, defaultLength, cap);

  if (value.length <= maxLength) {
    return true;
  }

  setFieldError(
    errors,
    definition.key,
    `${definition.key} must have at most ${maxLength} characters`,
  );

  return false;
}

/**
 * Validates and normalizes a text-like value.
 * @param {object} definition - Field definition.
 * @param {unknown} value - Raw value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @returns {string|undefined} The normalized value or undefined when omitted.
 */
function normalizeText(definition, value, errors) {
  const trimmed = readStringValue(
    definition,
    value,
    errors,
    `${definition.key} must be a string`,
  );

  if (trimmed === undefined) {
    return undefined;
  }

  return fitsMaxLength(
    definition,
    trimmed,
    DEFAULT_TEXT_MAX_LENGTH,
    DEFAULT_TEXT_MAX_LENGTH,
    errors,
  )
    ? trimmed
    : undefined;
}

/**
 * Validates and normalizes an email value.
 * @param {object} definition - Field definition.
 * @param {unknown} value - Raw value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @returns {string|undefined} The normalized value or undefined when omitted.
 */
function normalizeEmail(definition, value, errors) {
  const key = definition.key;
  const trimmed = readStringValue(
    definition,
    value,
    errors,
    `${key} must be a string`,
  );

  if (trimmed === undefined) {
    return undefined;
  }

  if (
    !fitsMaxLength(
      definition,
      trimmed,
      DEFAULT_TEXT_MAX_LENGTH,
      DEFAULT_TEXT_MAX_LENGTH,
      errors,
    ) ||
    !fitsMaxLength(
      definition,
      trimmed,
      EMAIL_MAX_LENGTH,
      EMAIL_MAX_LENGTH,
      errors,
    )
  ) {
    return undefined;
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    setFieldError(errors, key, `${key} must be a valid email`);

    return undefined;
  }

  return trimmed;
}

/**
 * Validates and normalizes a phone value.
 * @param {object} definition - Field definition.
 * @param {unknown} value - Raw value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @returns {string|undefined} The normalized value or undefined when omitted.
 */
function normalizePhone(definition, value, errors) {
  const key = definition.key;
  const trimmed = readStringValue(
    definition,
    value,
    errors,
    `${key} must be a valid phone`,
  );

  if (trimmed === undefined) {
    return undefined;
  }

  const maxLength = maxLengthOf(definition, PHONE_MAX_LENGTH, PHONE_MAX_LENGTH);

  if (
    trimmed.length < PHONE_MIN_LENGTH ||
    trimmed.length > maxLength ||
    !PHONE_PATTERN.test(trimmed) ||
    !/[0-9]/.test(trimmed)
  ) {
    setFieldError(errors, key, `${key} must be a valid phone`);

    return undefined;
  }

  return trimmed;
}

/**
 * Validates and normalizes an integer value, accepting integer numbers and
 * numeric strings without decimals.
 * @param {object} definition - Field definition.
 * @param {unknown} value - Raw value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @returns {number|undefined} The normalized integer or undefined.
 */
function normalizeInteger(definition, value, errors) {
  const key = definition.key;
  const isIntegerNumber = typeof value === "number" && Number.isInteger(value);
  const isIntegerString =
    typeof value === "string" && INTEGER_PATTERN.test(value.trim());

  if (!isIntegerNumber && !isIntegerString) {
    setFieldError(errors, key, `${key} must be an integer`);

    return undefined;
  }

  return Number(value);
}

/**
 * Validates a strict boolean value.
 * @param {object} definition - Field definition.
 * @param {unknown} value - Raw value.
 * @param {Record<string, string>} errors - Error accumulator.
 * @returns {boolean|undefined} The boolean or undefined.
 */
function normalizeBoolean(definition, value, errors) {
  if (typeof value !== "boolean") {
    setFieldError(
      errors,
      definition.key,
      `${definition.key} must be a boolean`,
    );

    return undefined;
  }

  return value;
}

/**
 * Strategy table that maps every field type accepted by HU-28 to its
 * normalizer. Adding a field type only requires one entry here.
 */
const TYPE_NORMALIZERS = Object.freeze({
  text: normalizeText,
  email: normalizeEmail,
  phone: normalizePhone,
  integer: normalizeInteger,
  boolean: normalizeBoolean,
});

module.exports = {
  DEFAULT_TEXT_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PHONE_MIN_LENGTH,
  TYPE_NORMALIZERS,
  requiredError,
  setFieldError,
};
