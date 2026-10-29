const yup = require("yup");

const REQUIRED_SHELF_FIELDS = Object.freeze(["warehouse_id", "code"]);
const REQUIRED_SECTION_FIELDS = Object.freeze(["code"]);
const SHELF_UPDATE_FIELDS = Object.freeze(["code", "name", "description"]);
const SECTION_UPDATE_FIELDS = Object.freeze(["code", "name", "description"]);

const CODE_PATTERN = /^[A-Z0-9_-]{1,50}$/;
const MAX_CODE_LENGTH = 50;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 255;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const CODE_MESSAGE = "code must match ^[A-Za-z0-9_-]{1,50}$";
const NAME_MESSAGE = "name must have at most 100 characters";
const DESCRIPTION_MESSAGE = "description must have at most 255 characters";
const WAREHOUSE_ID_MESSAGE = "Invalid warehouse id";
const SHELF_ID_MESSAGE = "Invalid shelf id";
const SECTION_ID_MESSAGE = "Invalid section id";
const INCLUDE_MESSAGE = "Invalid include";
const WAREHOUSE_IMMUTABLE_MESSAGE = "warehouse_id cannot be changed";
const SHELF_IMMUTABLE_MESSAGE = "shelf_id cannot be changed";

/**
 * Builds the trimmed, uppercase code schema. Codes are stable keys and match
 * `^[A-Z0-9_-]{1,50}$` after normalization.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The code schema.
 */
function codeField(required = false) {
  const schema = yup
    .string()
    .transform((value) =>
      typeof value === "string" ? value.trim().toUpperCase() : value,
    )
    .typeError(CODE_MESSAGE)
    .test("is-string", CODE_MESSAGE, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .max(MAX_CODE_LENGTH, CODE_MESSAGE)
    .matches(CODE_PATTERN, CODE_MESSAGE);

  return required ? schema.required(CODE_MESSAGE) : schema;
}

/**
 * Builds an optional trimmed string field. Omitted and null values stay null,
 * blank strings become null and longer values are rejected.
 * @param {string} message - Error message for invalid values.
 * @param {number} maxLength - Maximum accepted length.
 * @returns {import("yup").StringSchema} The optional string schema.
 */
function optionalStringField(message, maxLength) {
  return yup
    .string()
    .transform((value) => {
      if (value === null) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();

      return trimmed === "" ? null : trimmed;
    })
    .typeError(message)
    .test("is-string", message, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(maxLength, message)
    .nullable();
}

/**
 * Builds a positive integer identifier schema.
 * @param {string} message - Error message for invalid values.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The identifier schema.
 */
function positiveIntegerField(message, required = false) {
  const schema = yup
    .number()
    .transform((value) => (value === null ? NaN : value))
    .typeError(message)
    .integer(message)
    .min(1, message);

  return required ? schema.required(message) : schema;
}

/**
 * Builds the optional `name` and `description` fields shared by shelves and
 * sections. Creation defaults them to null so the response always exposes the
 * keys; updates leave them undefined so partial bodies stay partial.
 * @param {object} [options] - Field options.
 * @param {boolean} [options.withDefaults] - Default the absent values to null.
 * @returns {object} The yup field map.
 */
function locationTextFieldMap({ withDefaults = false } = {}) {
  const name = optionalStringField(NAME_MESSAGE, MAX_NAME_LENGTH);
  const description = optionalStringField(
    DESCRIPTION_MESSAGE,
    MAX_DESCRIPTION_LENGTH,
  );

  return {
    name: withDefaults ? name.default(null) : name,
    description: withDefaults ? description.default(null) : description,
  };
}

const createShelfSchema = yup.object({
  warehouse_id: positiveIntegerField(WAREHOUSE_ID_MESSAGE, true),
  code: codeField(true),
  ...locationTextFieldMap({ withDefaults: true }),
});

const updateLocationSchema = yup.object({
  code: codeField(),
  ...locationTextFieldMap(),
});

const createSectionSchema = yup.object({
  code: codeField(true),
  ...locationTextFieldMap({ withDefaults: true }),
});

const updateShelfSchema = updateLocationSchema;
const updateSectionSchema = updateLocationSchema;

/**
 * Parses a positive integer identifier coming from a route or query.
 * @param {unknown} value - Raw value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parsePositiveInteger(value) {
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

/**
 * Parses a shelf id or `warehouse_id` filter.
 * @param {unknown} value - Raw value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseShelfId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses a section id.
 * @param {unknown} value - Raw value.
 * @returns {number|null} The positive integer or null when invalid.
 */
function parseSectionId(value) {
  return parsePositiveInteger(value);
}

/**
 * Parses the `include=sections` query flag.
 * @param {unknown} value - Raw query value.
 * @returns {boolean|null} True for `sections`, false when omitted and null
 *   when the value is not supported.
 */
function parseIncludeSections(value) {
  if (value === undefined) {
    return false;
  }

  if (value === "sections") {
    return true;
  }

  return null;
}

module.exports = {
  CODE_MESSAGE,
  CODE_PATTERN,
  DESCRIPTION_MESSAGE,
  INCLUDE_MESSAGE,
  MAX_CODE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  NAME_MESSAGE,
  REQUIRED_SECTION_FIELDS,
  REQUIRED_SHELF_FIELDS,
  SECTION_ID_MESSAGE,
  SECTION_UPDATE_FIELDS,
  SHELF_ID_MESSAGE,
  SHELF_IMMUTABLE_MESSAGE,
  SHELF_UPDATE_FIELDS,
  WAREHOUSE_ID_MESSAGE,
  WAREHOUSE_IMMUTABLE_MESSAGE,
  createSectionSchema,
  createShelfSchema,
  optionalStringField,
  parseIncludeSections,
  parsePositiveInteger,
  parseSectionId,
  parseShelfId,
  updateSectionSchema,
  updateShelfSchema,
};
