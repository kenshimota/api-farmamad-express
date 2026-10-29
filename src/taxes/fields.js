/**
 * Field contract shared by the validation, authorization and service layers.
 * Keeping it in one place avoids the validator schema and the service drifting
 * apart when a new editable field is added.
 */
const REQUIRED_TAX_FIELDS = Object.freeze(["code", "name", "rate"]);
const UPDATE_TAX_FIELDS = Object.freeze([
  "name",
  "rate",
  "description",
  "is_active",
]);

module.exports = { REQUIRED_TAX_FIELDS, UPDATE_TAX_FIELDS };
