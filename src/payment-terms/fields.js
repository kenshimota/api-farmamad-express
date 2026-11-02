/**
 * Field contract shared by validation, authorization and the service layer.
 * Keeping it in one place avoids the schema and the service drifting apart
 * when a field is added.
 */
const REQUIRED_PAYMENT_TERM_FIELDS = Object.freeze(["code", "name", "days"]);
const UPDATE_PAYMENT_TERM_FIELDS = Object.freeze([
  "name",
  "description",
  "days",
  "is_active",
]);

module.exports = {
  REQUIRED_PAYMENT_TERM_FIELDS,
  UPDATE_PAYMENT_TERM_FIELDS,
};
