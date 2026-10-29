const yup = require("yup");

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;
const ALLOWED_FIELD_TYPES = Object.freeze([
  "text",
  "email",
  "phone",
  "integer",
  "boolean",
]);
const MAX_LENGTH_FIELD_TYPES = Object.freeze(["text", "email", "phone"]);
const MAX_FIELDS = 20;
const MIN_MAX_LENGTH = 1;
const MAX_MAX_LENGTH = 255;

const FIELDS_MESSAGE = "Invalid fields definition";

/**
 * Schema of one field definition. Unknown properties are rejected so the
 * persisted JSONB only contains the documented keys. It is built once because
 * yup schemas are immutable and reusable.
 * @type {import("yup").ObjectSchema}
 */
const FIELD_DEFINITION_SCHEMA = yup
  .object({
    key: yup
      .string()
      .typeError(FIELDS_MESSAGE)
      .matches(KEY_PATTERN, FIELDS_MESSAGE)
      .required(FIELDS_MESSAGE),
    label: yup
      .string()
      .typeError(FIELDS_MESSAGE)
      .min(1, FIELDS_MESSAGE)
      .max(100, FIELDS_MESSAGE)
      .required(FIELDS_MESSAGE),
    type: yup
      .string()
      .typeError(FIELDS_MESSAGE)
      .oneOf([...ALLOWED_FIELD_TYPES], FIELDS_MESSAGE)
      .required(FIELDS_MESSAGE),
    required: yup.boolean().required(FIELDS_MESSAGE),
    max_length: yup
      .number()
      .integer(FIELDS_MESSAGE)
      .min(MIN_MAX_LENGTH, FIELDS_MESSAGE)
      .max(MAX_MAX_LENGTH, FIELDS_MESSAGE),
  })
  .noUnknown(true, FIELDS_MESSAGE);

/**
 * Returns the reusable field definition schema.
 * @returns {import("yup").ObjectSchema} The definition schema.
 */
function fieldDefinitionSchema() {
  return FIELD_DEFINITION_SCHEMA;
}

/**
 * Tells whether a `fields` value follows RF-05: an array of at most 20
 * definitions with unique keys, allowed types, strict booleans and
 * `max_length` only on text-like types.
 * @param {unknown} value - Candidate fields definition.
 * @returns {boolean} True when the definition is valid.
 */
function isValidFieldsDefinition(value) {
  if (!Array.isArray(value) || value.length > MAX_FIELDS) {
    return false;
  }

  const keys = new Set();

  for (const definition of value) {
    if (!FIELD_DEFINITION_SCHEMA.isValidSync(definition, { strict: true })) {
      return false;
    }

    if (
      definition.max_length !== undefined &&
      !MAX_LENGTH_FIELD_TYPES.includes(definition.type)
    ) {
      return false;
    }

    if (keys.has(definition.key)) {
      return false;
    }

    keys.add(definition.key);
  }

  return true;
}

module.exports = {
  ALLOWED_FIELD_TYPES,
  FIELDS_MESSAGE,
  KEY_PATTERN,
  MAX_FIELDS,
  MAX_LENGTH_FIELD_TYPES,
  MAX_MAX_LENGTH,
  MIN_MAX_LENGTH,
  fieldDefinitionSchema,
  isValidFieldsDefinition,
};
