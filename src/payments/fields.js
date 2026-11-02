/**
 * Field contract shared by the validation, authorization and service layers.
 */
const REQUIRED_PAYMENT_FIELDS = Object.freeze([
  "customer_id",
  "method_payment_id",
  "amount",
]);

const PAYMENT_UPDATE_FIELDS = Object.freeze([
  "reference",
  "notes",
  "paid_at",
  "customer_id",
  "method_payment_id",
  "currency_id",
  "amount",
]);

const IMMUTABLE_PAYMENT_FIELDS = Object.freeze([
  "customer_id",
  "method_payment_id",
  "currency_id",
  "amount",
]);

module.exports = {
  IMMUTABLE_PAYMENT_FIELDS,
  PAYMENT_UPDATE_FIELDS,
  REQUIRED_PAYMENT_FIELDS,
};
