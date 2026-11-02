const { toPublicCurrencySummary } = require("../currencies/serializer");
const { toPublicImage } = require("../images/serializer");
const { toPublicWallet } = require("../wallets/serializer");
const { readField, toDecimalNumber } = require("../shared/serializer");

/**
 * Builds the compact actor nested in a history event.
 * @param {object|null} actor - User instance or null.
 * @returns {{ id: number, username: string, email: string }|null} Public actor.
 */
function toPublicActor(actor) {
  if (!actor || typeof actor !== "object") {
    return null;
  }

  return {
    id: readField(actor, "id"),
    username: readField(actor, "username"),
    email: readField(actor, "email"),
  };
}

/**
 * Builds one public history event.
 * @param {object} event - PaymentStatusHistory instance or plain object.
 * @returns {object} Public event.
 */
function toPublicHistoryEvent(event) {
  return {
    id: readField(event, "id"),
    from_status: readField(event, "from_status"),
    to_status: readField(event, "to_status"),
    reason: readField(event, "reason"),
    created_at: toTimestamp(readField(event, "createdAt")),
    actor: toPublicActor(readField(event, "actor")),
  };
}

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
function toPublicPayment(payment, { includeHistory = false } = {}) {
  const currency = readField(payment, "currency");
  const method = readField(payment, "method_payment");
  const statusDetail = readField(payment, "status_detail");
  const referenceImage = readField(payment, "reference_image");

  const serialized = {
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
    status: readField(payment, "status") ?? "pending",
    status_name: statusDetail ? readField(statusDetail, "name") : null,
    rejection_reason: readField(payment, "rejection_reason"),
    reference_image_id: readField(payment, "reference_image_id"),
    reference_image: referenceImage ? toPublicImage(referenceImage) : null,
  };

  if (includeHistory) {
    const history = readField(payment, "history");

    serialized.history = Array.isArray(history)
      ? history.map((event) => toPublicHistoryEvent(event))
      : [];
  }

  return serialized;
}

/**
 * Builds the creation response: the payment plus the credited wallet.
 * @param {object} payment - Created payment with its relations.
 * @param {object} wallet - Credited wallet with its currency.
 * @returns {object} Public payment with the nested wallet.
 */
function toPublicPaymentWithWallet(payment, wallet, options = {}) {
  return {
    ...toPublicPayment(payment, options),
    wallet: wallet ? toPublicWallet(wallet) : null,
  };
}

module.exports = {
  toPublicActor,
  toPublicHistoryEvent,
  toPublicMethodPaymentSummary,
  toPublicPayment,
  toPublicPaymentWithWallet,
};
