const yup = require("yup");
const {
  ALLOWED_FIELD_TYPES,
  FIELDS_MESSAGE,
  KEY_PATTERN,
  MAX_FIELDS,
  MAX_LENGTH_FIELD_TYPES,
  fieldDefinitionSchema,
  isValidFieldsDefinition,
} = require("./field-definition");
const {
  REQUIRED_METHOD_PAYMENT_TYPE_FIELDS,
  UPDATE_METHOD_PAYMENT_TYPE_FIELDS,
} = require("./fields");

const CODE_PATTERN = /^[A-Z0-9_]{2,30}$/;
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 255;

const CODE_MESSAGE = "code must match ^[A-Z0-9_]{2,30}$";
const NAME_MESSAGE = "name must be between 1 and 100 characters";
const CURRENCY_ID_MESSAGE = "Invalid currency";
const DESCRIPTION_MESSAGE = "description must have at most 255 characters";
const IS_ACTIVE_MESSAGE = "is_active must be a boolean";
const IS_ACTIVE_FILTER_MESSAGE = "Invalid is_active";
const CURRENCY_FILTER_MESSAGE = "Invalid currency_id";

/**
 * Builds the trimmed, uppercase code schema. Codes are stable keys and match
 * `^[A-Z0-9_]{2,30}$` after normalization.
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
    .matches(CODE_PATTERN, CODE_MESSAGE);

  return required ? schema.required(CODE_MESSAGE) : schema;
}

/**
 * Builds a trimmed string schema with the documented length limits.
 * @param {string} message - Error message for invalid values.
 * @param {number} minLength - Minimum accepted length.
 * @param {number} maxLength - Maximum accepted length.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The string schema.
 */
function trimmedStringField(message, minLength, maxLength, required = false) {
  const schema = yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(message)
    .test("is-string", message, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(minLength, message)
    .max(maxLength, message)
    .matches(/\S/, message);

  return required ? schema.required(message) : schema;
}

/**
 * Builds the optional description schema. Omitted and null values are
 * accepted, strings are trimmed, blank strings become null and 256+
 * characters are rejected.
 * @returns {import("yup").StringSchema} The description schema.
 */
function descriptionField() {
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
    .typeError(DESCRIPTION_MESSAGE)
    .test("is-string", DESCRIPTION_MESSAGE, function isString(value) {
      return value == null || typeof this.originalValue === "string";
    })
    .max(MAX_DESCRIPTION_LENGTH, DESCRIPTION_MESSAGE)
    .nullable();
}

/**
 * Builds the strict boolean schema used by `is_active`, so text and numeric
 * representations are rejected instead of silently cast.
 * @returns {import("yup").BooleanSchema} The boolean schema.
 */
function isActiveField() {
  return yup
    .boolean()
    .typeError(IS_ACTIVE_MESSAGE)
    .test("is-boolean", IS_ACTIVE_MESSAGE, function isBoolean(value) {
      return (
        value === undefined ||
        this.originalValue === undefined ||
        typeof this.originalValue === "boolean"
      );
    });
}

/**
 * Builds the positive integer schema used by `currency_id`. Non-numeric
 * values are reported with the same `Invalid currency` message so the client
 * cannot tell a format error from a missing or inactive currency.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The currency id schema.
 */
function currencyIdField(required = false) {
  const schema = yup
    .number()
    .transform((value, originalValue) => {
      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(CURRENCY_ID_MESSAGE)
    .test("is-integer-string", CURRENCY_ID_MESSAGE, function isInteger(value) {
      if (value === undefined) {
        return true;
      }

      if (typeof this.originalValue === "number") {
        return Number.isInteger(this.originalValue);
      }

      return (
        typeof this.originalValue === "string" &&
        /^\d+$/.test(this.originalValue.trim())
      );
    })
    .integer(CURRENCY_ID_MESSAGE)
    .positive(CURRENCY_ID_MESSAGE);

  return required ? schema.required(CURRENCY_ID_MESSAGE) : schema;
}

/**
 * Builds the schema of an arbitrary JSON value that must be a valid `fields`
 * definition. The whole array reports a single `fields` error, matching the
 * API contract.
 * @param {object} [options] - Schema options.
 * @param {boolean} [options.withDefault] - Default to `[]` when omitted.
 * @returns {import("yup").MixedSchema} The fields schema.
 */
function fieldsField({ withDefault = false } = {}) {
  const schema = yup
    .mixed()
    .nullable()
    .test("valid-fields", FIELDS_MESSAGE, (value) =>
      value === undefined ? true : isValidFieldsDefinition(value),
    );

  return withDefault ? schema.default([]) : schema;
}

const createMethodPaymentTypeSchema = yup.object({
  code: codeField(true),
  name: trimmedStringField(
    NAME_MESSAGE,
    MIN_NAME_LENGTH,
    MAX_NAME_LENGTH,
    true,
  ),
  currency_id: currencyIdField(true),
  fields: fieldsField({ withDefault: true }),
  description: descriptionField().default(null),
  is_active: isActiveField().default(true),
});

const updateMethodPaymentTypeSchema = yup.object({
  name: trimmedStringField(NAME_MESSAGE, MIN_NAME_LENGTH, MAX_NAME_LENGTH),
  currency_id: currencyIdField(),
  fields: fieldsField(),
  description: descriptionField(),
  is_active: isActiveField(),
});

module.exports = {
  ALLOWED_FIELD_TYPES,
  CODE_MESSAGE,
  CODE_PATTERN,
  CURRENCY_FILTER_MESSAGE,
  CURRENCY_ID_MESSAGE,
  DESCRIPTION_MESSAGE,
  FIELDS_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  IS_ACTIVE_MESSAGE,
  KEY_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_FIELDS,
  MAX_LENGTH_FIELD_TYPES,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  NAME_MESSAGE,
  REQUIRED_METHOD_PAYMENT_TYPE_FIELDS,
  UPDATE_METHOD_PAYMENT_TYPE_FIELDS,
  createMethodPaymentTypeSchema,
  currencyIdField,
  fieldDefinitionSchema,
  fieldsField,
  isValidFieldsDefinition,
  updateMethodPaymentTypeSchema,
};
