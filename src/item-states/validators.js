const yup = require("yup");

const REQUIRED_ITEM_STATE_FIELDS = ["name", "label"];
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_LABEL_LENGTH = 2;
const MAX_LABEL_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 255;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const NAME_MESSAGE = "name must be snake_case";
const LABEL_MESSAGE = "label is invalid";
const DESCRIPTION_MESSAGE = "description is invalid";
const IS_SELLABLE_MESSAGE = "is_sellable must be a boolean";

/**
 * Builds the trimmed snake_case name schema. Only lowercase letters, digits
 * and underscores are accepted, with the documented length limits.
 * @param {string} message - Error message for invalid values.
 * @returns {import("yup").StringSchema} The name schema.
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
    .matches(/^[a-z0-9_]+$/, message);
}

/**
 * Builds a trimmed string schema with the documented length limits that
 * rejects non-string values without crashing on the trim transform.
 * @param {string} message - Error message for invalid values.
 * @param {number} minLength - Minimum accepted length.
 * @param {number} maxLength - Maximum accepted length.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedString(message, minLength, maxLength) {
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
    .min(minLength, message)
    .max(maxLength, message)
    .matches(/\S/, message);
}

/**
 * Builds the optional description schema: null and blank values become null
 * while present values are trimmed and limited to 255 characters.
 * @param {boolean} withDefault - Whether an omitted description becomes null.
 * @returns {import("yup").StringSchema} The description schema.
 */
function descriptionField(withDefault) {
  const schema = yup
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
    .typeError(DESCRIPTION_MESSAGE)
    .test("is-string", DESCRIPTION_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_DESCRIPTION_LENGTH, DESCRIPTION_MESSAGE)
    .nullable();

  return withDefault ? schema.default(null) : schema;
}

/**
 * Builds the boolean schema that rejects string and numeric representations
 * instead of silently casting them.
 * @param {boolean} withDefault - Whether an omitted flag becomes false.
 * @returns {import("yup").BooleanSchema} The is_sellable schema.
 */
function sellableField(withDefault) {
  const schema = yup
    .boolean()
    .typeError(IS_SELLABLE_MESSAGE)
    .test("is-boolean", IS_SELLABLE_MESSAGE, function isBoolean(value) {
      return (
        value === undefined ||
        this.originalValue === undefined ||
        typeof this.originalValue === "boolean"
      );
    });

  return withDefault ? schema.default(false) : schema;
}

const createItemStateSchema = yup.object({
  name: nameField(NAME_MESSAGE),
  label: trimmedString(LABEL_MESSAGE, MIN_LABEL_LENGTH, MAX_LABEL_LENGTH),
  description: descriptionField(true),
  is_sellable: sellableField(true),
});

const updateItemStateSchema = yup.object({
  name: nameField(NAME_MESSAGE),
  label: trimmedString(LABEL_MESSAGE, MIN_LABEL_LENGTH, MAX_LABEL_LENGTH),
  description: descriptionField(false),
  is_sellable: sellableField(false),
});

/**
 * Parses an item state id coming from a route parameter. Only positive
 * integers are accepted; anything else is reported as null so the caller can
 * answer 422.
 * @param {unknown} value - Raw route parameter.
 * @returns {number|null} The positive integer id or null when invalid.
 */
function parseItemStateId(value) {
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
 * Parses the `is_sellable` query filter. Only the literal values true and
 * false (also as strings) are accepted; anything else resolves to undefined so
 * the caller can answer 422.
 * @param {unknown} value - Raw query value.
 * @returns {boolean|undefined} The parsed flag or undefined when invalid.
 */
function parseSellable(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return undefined;
}

module.exports = {
  createItemStateSchema,
  DESCRIPTION_MESSAGE,
  IS_SELLABLE_MESSAGE,
  LABEL_MESSAGE,
  MAX_DESCRIPTION_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_NAME_LENGTH,
  MIN_LABEL_LENGTH,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  parseItemStateId,
  parseSellable,
  REQUIRED_ITEM_STATE_FIELDS,
  updateItemStateSchema,
};
