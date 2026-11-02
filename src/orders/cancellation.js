const { readField } = require("../shared/serializer");
const { EVENTS, ORDER_STATUSES } = require("./constants");

/**
 * Creates the cancellation side effect: releases every active reservation,
 * changes the status and appends the history event. Physical stock is never
 * touched.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {object} dependencies.reservation - Reservation service.
 * @param {object} dependencies.history - History service.
 * @returns {object} The cancellation service.
 */
function createOrderCancellationService({ repository, reservation, history }) {
  return {
    /**
     * Cancels an order from a non-terminal status.
     * @param {object} order - Locked order.
     * @param {object} context - Actor context.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<void>}
     */
    async cancel(order, context, transaction) {
      const fromStatus = readField(order, "status");

      await reservation.release(readField(order, "id"), transaction);
      await repository.updateOrder(
        order,
        { status: ORDER_STATUSES.CANCELLED },
        { transaction },
      );
      await history.append(
        {
          orderId: readField(order, "id"),
          eventType: EVENTS.STATUS_CHANGED,
          fromStatus,
          toStatus: ORDER_STATUSES.CANCELLED,
          actorUserId: context.userId,
        },
        transaction,
      );
    },
  };
}

module.exports = { createOrderCancellationService };
