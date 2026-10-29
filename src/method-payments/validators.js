const yup = require("yup");
const { isPlainObject } = require("./details");

const MIN_LABEL_LENGTH = 1;
const MAX_LABEL_LENGTH = 100;

const LABEL_MESSAGE = "label must be between 1 and 100 characters";
const PAYMENT_TYPE_MESSAGE = "Invalid payment type";
const DETAILS_MESSAGE = "details must be an object";
const IS_ACTIVE_MESSAGE = "is_active must be a boolean";
const IS_ACTIVE_FILTER_MESSAGE = "Invalid is_active";
const CURRENCY_FILTER_MESSAGE = "Invalid currency_id";
const PAYMENT_TYPE_FILTER_MESSAGE = "Invalid method_payment_type_id";

/**
 * Builds the trimmed label schema.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").StringSchema} The label schema.
 */
function labelField(required = false) {
  const schema = yup
    .string()
    .transform((value) => (typeof value === "string" ? value.trim() : value))
    .typeError(LABEL_MESSAGE)
    .test("is-string", LABEL_MESSAGE, function isString(value) {
      return value === undefined || typeof this.originalValue === "string";
    })
    .min(MIN_LABEL_LENGTH, LABEL_MESSAGE)
    .max(MAX_LABEL_LENGTH, LABEL_MESSAGE)
    .matches(/\S/, LABEL_MESSAGE);

  return required ? schema.required(LABEL_MESSAGE) : schema;
}

/**
 * Builds the positive integer schema used by `method_payment_type_id`.
 * @param {boolean} [required] - Whether the field is mandatory.
 * @returns {import("yup").NumberSchema} The payment type id schema.
 */
function paymentTypeIdField(required = false) {
  const schema = yup
    .number()
    .transform((value, originalValue) => {
      if (typeof originalValue === "string" && originalValue.trim() === "") {
        return NaN;
      }

      return value;
    })
    .typeError(PAYMENT_TYPE_MESSAGE)
    .test("is-integer-string", PAYMENT_TYPE_MESSAGE, function isInteger(value) {
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
    .integer(PAYMENT_TYPE_MESSAGE)
    .positive(PAYMENT_TYPE_MESSAGE);

  return required ? schema.required(PAYMENT_TYPE_MESSAGE) : schema;
}

/**
 * Builds the details schema. Only the plain-object shape is checked here; the
 * keys and values are validated against the type fields by `validateDetails`
 * inside the service transaction.
 * @returns {import("yup").MixedSchema} The details schema.
 */
function detailsField() {
  return yup
    .mixed()
    .test("plain-object", DETAILS_MESSAGE, (value) =>
      value === undefined ? true : isPlainObject(value),
    );
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

const createMethodPaymentSchema = yup.object({
  method_payment_type_id: paymentTypeIdField(true),
  label: labelField(true),
  details: detailsField().required(DETAILS_MESSAGE),
  is_active: isActiveField().default(true),
});

const updateMethodPaymentSchema = yup.object({
  method_payment_type_id: paymentTypeIdField(),
  label: labelField(),
  details: detailsField(),
  is_active: isActiveField(),
});

module.exports = {
  CURRENCY_FILTER_MESSAGE,
  DETAILS_MESSAGE,
  IS_ACTIVE_FILTER_MESSAGE,
  IS_ACTIVE_MESSAGE,
  LABEL_MESSAGE,
  MAX_LABEL_LENGTH,
  MIN_LABEL_LENGTH,
  PAYMENT_TYPE_FILTER_MESSAGE,
  PAYMENT_TYPE_MESSAGE,
  createMethodPaymentSchema,
  detailsField,
  isActiveField,
  labelField,
  paymentTypeIdField,
  updateMethodPaymentSchema,
};
