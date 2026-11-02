const { toPublicCurrencySummary } = require("../currencies/serializer");
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
 * Builds the nested user that created a wallet movement.
 * @param {object|null} user - User instance or null.
 * @returns {{ id: number, username: string, email: string }|null} Public user.
 */
function toPublicCreatedBy(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    id: readField(user, "id"),
    username: readField(user, "username"),
    email: readField(user, "email"),
  };
}

/**
 * Builds the public representation of a customer wallet.
 * @param {object} wallet - CustomerWallet instance or plain object.
 * @returns {{ id: number, customer_id: number, currency_id: number,
 *   currency: object|null, balance: number|null }} Public wallet.
 */
function toPublicWallet(wallet) {
  const currency = readField(wallet, "currency");

  return {
    id: readField(wallet, "id"),
    customer_id: readField(wallet, "customer_id"),
    currency_id: readField(wallet, "currency_id"),
    currency: currency ? toPublicCurrencySummary(currency) : null,
    balance: toDecimalNumber(readField(wallet, "balance"), 2),
  };
}

/**
 * Reads the currency of a movement through its wallet association.
 * @param {object} transaction - WalletTransaction instance.
 * @returns {object|null} The currency instance or null.
 */
function readTransactionCurrency(transaction) {
  const wallet = readField(transaction, "wallet");

  return wallet ? readField(wallet, "currency") : null;
}

/**
 * Builds the public representation of one wallet movement. `created_by` is
 * only included when the caller asks for it, which keeps the customer view
 * free of staff data.
 * @param {object} transaction - WalletTransaction instance or plain object.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeCreatedBy] - Include the staff user.
 * @returns {object} Public movement.
 */
function toPublicWalletTransaction(transaction, { includeCreatedBy } = {}) {
  const currency = readTransactionCurrency(transaction);
  const serialized = {
    id: readField(transaction, "id"),
    transaction_type: readField(transaction, "transaction_type"),
    amount: toDecimalNumber(readField(transaction, "amount"), 2),
    balance_after: toDecimalNumber(readField(transaction, "balance_after"), 2),
    currency: currency ? toPublicCurrencySummary(currency) : null,
    payment_id: readField(transaction, "payment_id"),
    invoice_id: readField(transaction, "invoice_id"),
    payment_allocation_id: readField(transaction, "payment_allocation_id"),
    description: readField(transaction, "description"),
    created_at: toTimestamp(readField(transaction, "createdAt")),
  };

  if (includeCreatedBy) {
    serialized.created_by = toPublicCreatedBy(
      readField(transaction, "created_by"),
    );
  }

  return serialized;
}

module.exports = {
  toPublicWallet,
  toPublicWalletTransaction,
};
