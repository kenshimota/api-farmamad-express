const { readField } = require("../shared/serializer");
const { paymentRepository } = require("./repository");
const { toCents } = require("./money");
const {
  PAYMENT_STATUS,
  PAYMENT_STATUS_CODES,
  canTransition,
} = require("./statuses");
const {
  invalidStatus,
  invalidStatusTransition,
  paymentNotFound,
  rejectionReasonRequired,
} = require("./errors");

/**
 * Trims a rejected reason and enforces the documented minimum.
 * @param {unknown} value - Raw reason.
 * @returns {string} The trimmed reason.
 * @throws {Error} 422 when the reason is missing or shorter than three chars.
 */
function normalizeRejectedReason(value) {
  const reason = typeof value === "string" ? value.trim() : "";

  if (reason.length < 3) {
    throw rejectionReasonRequired();
  }

  return reason;
}

/**
 * Trims an optional conciliation reason.
 * @param {unknown} value - Raw reason.
 * @returns {string|null} The trimmed reason or null.
 */
function normalizeOptionalReason(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Persists the new status, appends exactly one history event and reloads the
 * payment. Shared by every transition strategy.
 * @param {object} context - Transition context.
 * @param {object} context.repository - Payment repository.
 * @param {object} context.payment - Locked payment row.
 * @param {number} context.userId - Authenticated actor id.
 * @param {object} context.options - Sequelize options with the transaction.
 * @param {string} context.toStatus - Target status code.
 * @param {string|null} context.reason - History reason.
 * @param {string|null} context.rejectionReason - Persisted rejection reason.
 * @returns {Promise<object>} The reloaded payment.
 */
async function commitTransition({
  repository,
  payment,
  userId,
  options,
  toStatus,
  reason,
  rejectionReason,
}) {
  const paymentId = readField(payment, "id");
  const fromStatus = readField(payment, "status");

  await repository.update(
    payment,
    { status: toStatus, rejection_reason: rejectionReason },
    options,
  );
  await repository.createStatusHistory(
    {
      payment_id: paymentId,
      from_status: fromStatus,
      to_status: toStatus,
      reason,
      actor_user_id: userId,
      metadata: null,
    },
    options,
  );

  return repository.findById(paymentId, options);
}

/**
 * Rejection strategy: stores the required reason and never touches the wallet.
 * @param {object} context - Transition context.
 * @returns {Promise<{ payment: object, wallet: null }>} The rejected payment.
 */
async function rejectTransition(context) {
  const reason = normalizeRejectedReason(context.values.reason);
  const payment = await commitTransition({
    ...context,
    toStatus: PAYMENT_STATUS.REJECTED,
    reason,
    rejectionReason: reason,
  });

  return { payment, wallet: null };
}

/**
 * Conciliation strategy: credits the wallet exactly once, appends the deposit
 * movement and then commits the status and history in the same transaction.
 * @param {object} context - Transition context.
 * @returns {Promise<{ payment: object, wallet: object }>} The payment and the
 *   credited wallet.
 */
async function conciliateTransition(context) {
  const { repository, payment, userId, options } = context;
  const reason = normalizeOptionalReason(context.values.reason);
  const wallet = await repository.findOrCreateWallet(
    readField(payment, "customer_id"),
    readField(payment, "currency_id"),
    options,
  );
  const amount = toCents(readField(payment, "amount"));
  const creditedWallet = await repository.incrementBalance(
    wallet,
    amount,
    options,
  );

  await repository.createWalletTransaction(
    {
      wallet_id: readField(wallet, "id"),
      transaction_type: "deposit",
      amount,
      balance_after: toCents(readField(creditedWallet, "balance")),
      payment_id: readField(payment, "id"),
      invoice_id: null,
      payment_allocation_id: null,
      description:
        readField(payment, "notes") ??
        readField(payment, "reference") ??
        reason,
      created_by_user_id: userId,
    },
    options,
  );

  const paymentAfter = await commitTransition({
    ...context,
    toStatus: PAYMENT_STATUS.CONCILIATED,
    reason,
    rejectionReason: null,
  });

  return { payment: paymentAfter, wallet: creditedWallet };
}

/**
 * Strategy registry keyed by target status. Every handler receives the same
 * context and returns `{ payment, wallet }`, so `changeStatus` stays free of
 * per-status branches.
 */
const TRANSITION_STRATEGIES = Object.freeze({
  [PAYMENT_STATUS.REJECTED]: rejectTransition,
  [PAYMENT_STATUS.CONCILIATED]: conciliateTransition,
});

/**
 * Creates the service that changes a payment status and keeps the wallet and
 * the append-only history consistent inside one transaction.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Payment repository.
 * @returns {object} The payment status service.
 */
function createPaymentStatusService({ repository = paymentRepository } = {}) {
  return {
    /**
     * Changes the status of one payment. `pending → conciliated` credits the
     * wallet exactly once and appends the deposit; `pending → rejected` stores
     * the reason and never touches the wallet. The payment row is locked with
     * `FOR UPDATE`, so concurrent requests serialize and only the first wins.
     * @param {number} paymentId - Payment id.
     * @param {object} values - Validated `status` and `reason`.
     * @param {number} userId - Authenticated actor id.
     * @returns {Promise<{ payment: object, wallet: object|null }>} The updated
     *   payment and the credited wallet, or null for a rejection.
     * @throws {Error} 404/422 for an unknown payment or invalid transition.
     */
    changeStatus(paymentId, values, userId) {
      return repository.transaction(async (transaction) => {
        const options = { transaction };
        const payment = await repository.findPaymentForUpdate(
          paymentId,
          transaction,
        );

        if (!payment) {
          throw paymentNotFound();
        }

        if (!PAYMENT_STATUS_CODES.includes(values.status)) {
          throw invalidStatus();
        }

        if (!canTransition(readField(payment, "status"), values.status)) {
          throw invalidStatusTransition();
        }

        const strategy = TRANSITION_STRATEGIES[values.status];

        if (!strategy) {
          throw invalidStatusTransition();
        }

        return strategy({ repository, payment, values, userId, options });
      });
    },

    /**
     * Lists the append-only status history of one payment.
     * @param {number} paymentId - Payment id.
     * @returns {Promise<object[]>} The events with their actor.
     */
    listHistory(paymentId) {
      return repository.listStatusHistory(paymentId);
    },
  };
}

const paymentStatusService = createPaymentStatusService();

module.exports = {
  createPaymentStatusService,
  normalizeOptionalReason,
  normalizeRejectedReason,
  paymentStatusService,
};
