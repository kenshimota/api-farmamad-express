const { toPublicCurrencySummary } = require("../currencies/serializer");
const { toPublicWallet } = require("../wallets/serializer");
const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Serializes a timestamp as an ISO string.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The timestamp or null.
 */
function toTimestamp(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Builds the compact method payment nested in a payment response.
 * @param {object|null} method - MethodPayment instance or null.
 * @returns {{ id: number, label: string }|null} Public method summary.
 */
function toPublicMethodPaymentSummary(method) {
  if (!method || typeof method !== "object") {
    return null;
  }

  return {
    id: readField(method, "id"),
    label: readField(method, "label"),
  };
}

/**
 * Builds the public representation of a received payment with no audit
 * columns and the relations nested.
 * @param {object} payment - Payment instance or plain object.
 * @returns {object} Public payment.
 */
function toPublicPayment(payment) {
  const currency = readField(payment, "currency");
  const method = readField(payment, "method_payment");

  return {
    id: readField(payment, "id"),
    customer_id: readField(payment, "customer_id"),
    method_payment_id: readField(payment, "method_payment_id"),
    method_payment: toPublicMethodPaymentSummary(method),
    currency_id: readField(payment, "currency_id"),
    currency: currency ? toPublicCurrencySummary(currency) : null,
    amount: toDecimalNumber(readField(payment, "amount"), 2),
    paid_at: toTimestamp(readField(payment, "paid_at")),
    reference: readField(payment, "reference"),
    notes: readField(payment, "notes"),
  };
}

/**
 * Builds the creation response: the payment plus the credited wallet.
 * @param {object} payment - Created payment with its relations.
 * @param {object} wallet - Credited wallet with its currency.
 * @returns {object} Public payment with the nested wallet.
 */
function toPublicPaymentWithWallet(payment, wallet) {
  return {
    ...toPublicPayment(payment),
    wallet: toPublicWallet(wallet),
  };
}

module.exports = {
  toPublicMethodPaymentSummary,
  toPublicPayment,
  toPublicPaymentWithWallet,
};
