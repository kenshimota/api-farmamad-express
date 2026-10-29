/**
 * Field contract shared by the validation, authorization and service layers.
 * Keeping it in one place avoids the validator schema and the service drifting
 * apart when a new editable field is added.
 */
const REQUIRED_METHOD_PAYMENT_FIELDS = Object.freeze([
  "method_payment_type_id",
  "label",
  "details",
]);
const UPDATE_METHOD_PAYMENT_FIELDS = Object.freeze([
  "label",
  "details",
  "is_active",
]);

module.exports = {
  REQUIRED_METHOD_PAYMENT_FIELDS,
  UPDATE_METHOD_PAYMENT_FIELDS,
};
