const { readField } = require("../shared/serializer");
const { EVENTS, ORDER_STATUSES } = require("./constants");
const { assertTransition } = require("./transition-policy");
const {
  configurationIncomplete,
  invalidPaymentTerm,
  invalidStatus,
  insufficientWalletBalance,
  orderNotFound,
  orderWithoutItems,
  paymentTermRequired,
} = require("./errors");

const EPSILON = 0.005;

/**
 * Creates the transition service that drives the order lifecycle.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {object} dependencies.access - Access helpers.
 * @param {object} dependencies.pricing - Pricing helper.
 * @param {object} dependencies.reservation - Reservation service.
 * @param {object} dependencies.history - History service.
 * @param {object} dependencies.invoicing - Invoicing service.
 * @param {object} dependencies.cancellation - Cancellation service.
 * @returns {object} The transition service.
 */
function createOrderTransitionService({
  repository,
  access,
  pricing,
  reservation,
  history,
  invoicing,
  cancellation,
}) {
  /**
   * Loads the required active payment term of an order.
   * @param {object} order - Loaded order.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object>} The active term.
   */
  async function requirePaymentTerm(order, transaction) {
    const termId = readField(order, "payment_term_id");

    if (termId === null || termId === undefined) {
      throw paymentTermRequired();
    }

    const term = await repository.findPaymentTermById(termId, { transaction });

    if (!term || readField(term, "is_active") === false) {
      throw invalidPaymentTerm();
    }

    return term;
  }

  /**
   * Ensures a cash order can be covered by the customer wallet balance.
   * @param {object} order - Loaded order.
   * @param {object} term - Active payment term.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function assertWalletBalance(order, term, transaction) {
    if (Number(readField(term, "days")) !== 0) {
      return;
    }

    const currency = await pricing.resolveOrderCurrency(order);
    const orderRate = Number(readField(currency, "rate"));
    const wallets = await repository.listWallets(
      readField(order, "customer_id"),
      transaction,
    );
    const available = wallets.reduce((sum, wallet) => {
      const walletCurrency = readField(wallet, "currency");
      const rate = walletCurrency
        ? Number(readField(walletCurrency, "rate"))
        : 0;

      return sum + (Number(readField(wallet, "balance")) * rate) / orderRate;
    }, 0);

    if (
      !Number.isFinite(orderRate) ||
      orderRate <= 0 ||
      available + EPSILON < Number(readField(order, "total"))
    ) {
      throw insufficientWalletBalance();
    }
  }

  /**
   * Validates the request preconditions and freezes the price snapshot.
   * @param {object} order - Locked order.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function prepareRequest(order, transaction) {
    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw orderWithoutItems();
    }

    await pricing.assertActiveTransactionCurrency();
    pricing.resolvePriceListId(order);
    await requirePaymentTerm(order, transaction);
    await pricing.recalculate(order, transaction);
  }

  /**
   * Validates and performs the generation with FEFO reservation.
   * @param {object} order - Locked order.
   * @param {string} source - Source status code.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function prepareGeneration(order, source, transaction) {
    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw orderWithoutItems();
    }

    const term = await requirePaymentTerm(order, transaction);

    if (source === ORDER_STATUSES.DRAFT) {
      await pricing.recalculate(order, transaction);
    }

    await assertWalletBalance(order, term, transaction);
    await reservation.reserve(order, transaction);
  }

  /**
   * Persists the destination status and appends its history event.
   * @param {object} order - Locked order.
   * @param {string} target - Destination status.
   * @param {object} context - Actor context.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function move(order, target, context, transaction) {
    const fromStatus = readField(order, "status");

    await repository.updateOrder(order, { status: target }, { transaction });
    await history.append(
      {
        orderId: readField(order, "id"),
        eventType: EVENTS.STATUS_CHANGED,
        fromStatus,
        toStatus: target,
        actorUserId: context.userId,
      },
      transaction,
    );
  }

  return {
    /**
     * Applies one status transition with its side effects in a single
     * transaction.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated body with `status`.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updateStatus(orderId, input, actor) {
      const context = await access.resolveContext(actor);
      const target = input.status;

      if (typeof target !== "string") {
        throw invalidStatus();
      }

      return repository.transaction(async (transaction) => {
        const targetStatus = await repository.findOrderStatusByCode(target, {
          transaction,
        });

        if (!targetStatus) {
          throw invalidStatus();
        }

        const order = await repository.findById(orderId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!order) {
          throw orderNotFound();
        }

        await access.assertEditAccess(order, context);

        const current = readField(order, "status");
        const currentStatus = await repository.findOrderStatusByCode(current, {
          transaction,
        });

        if (!currentStatus) {
          throw configurationIncomplete();
        }

        const decision = assertTransition({
          current,
          currentStatus,
          target,
          context,
        });

        if (decision.kind === "request") {
          await prepareRequest(order, transaction);
          await move(order, target, context, transaction);
        } else if (decision.kind === "generate") {
          await prepareGeneration(order, decision.source, transaction);
          await move(order, target, context, transaction);
        } else if (decision.kind === "invoice") {
          await invoicing.invoice(order, context, transaction);
        } else if (decision.kind === "cancel") {
          await cancellation.cancel(order, context, transaction);
        } else {
          await move(order, target, context, transaction);
        }

        return repository.findById(orderId, { transaction });
      });
    },
  };
}

module.exports = { createOrderTransitionService };
