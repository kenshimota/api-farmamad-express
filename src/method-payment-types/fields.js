/**
 * Field contract shared by the validation, authorization and service layers.
 * Keeping it in one place avoids the validator schema and the service drifting
 * apart when a new editable field is added.
 */
const REQUIRED_METHOD_PAYMENT_TYPE_FIELDS = Object.freeze([
  "code",
  "name",
  "currency_id",
]);
const UPDATE_METHOD_PAYMENT_TYPE_FIELDS = Object.freeze([
  "name",
  "currency_id",
  "fields",
  "description",
  "is_active",
]);
const IMMUTABLE_WITH_METHODS_FIELDS = Object.freeze(["currency_id", "fields"]);

module.exports = {
  IMMUTABLE_WITH_METHODS_FIELDS,
  REQUIRED_METHOD_PAYMENT_TYPE_FIELDS,
  UPDATE_METHOD_PAYMENT_TYPE_FIELDS,
};
