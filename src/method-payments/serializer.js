const { toPublicCurrencySummary } = require("../currencies/serializer");
const { readField } = require("../shared/serializer");

/**
 * Builds the nested payment type of a method payment.
 * @param {object|null} type - MethodPaymentType instance or plain object.
 * @returns {{ id: number, code: string, name: string }|null} Public type.
 */
function toPublicMethodPaymentType(type) {
  if (!type || typeof type !== "object") {
    return null;
  }

  return {
    id: readField(type, "id"),
    code: readField(type, "code"),
    name: readField(type, "name"),
  };
}

/**
 * Builds the public representation of a method payment with no audit columns.
 * The currency is inherited from the type, so it is never persisted on the
 * method itself.
 * @param {object} method - MethodPayment instance or plain object.
 * @returns {{ id: number, method_payment_type_id: number, label: string,
 *   details: object, is_active: boolean, currency_id: number|null,
 *   currency: object|null, method_payment_type: object|null }} Public data.
 */
function toPublicMethodPayment(method) {
  const type = readField(method, "method_payment_type");
  const currency = type ? readField(type, "currency") : null;
  const details = readField(method, "details");

  return {
    id: readField(method, "id"),
    method_payment_type_id: readField(method, "method_payment_type_id"),
    label: readField(method, "label"),
    details:
      details && typeof details === "object" && !Array.isArray(details)
        ? { ...details }
        : {},
    is_active: readField(method, "is_active") === true,
    currency_id: type ? readField(type, "currency_id") : null,
    currency: currency ? toPublicCurrencySummary(currency) : null,
    method_payment_type: toPublicMethodPaymentType(type),
  };
}

module.exports = { toPublicMethodPayment, toPublicMethodPaymentType };
