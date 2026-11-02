const { readField } = require("../shared/serializer");

/**
 * Creates the append-only order history helper.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @returns {object} The history service.
 */
function createOrderHistoryService({ repository }) {
  /**
   * Appends one event to the order history.
   * @param {object} values - Event values.
   * @param {object} values.orderId - Order id.
   * @param {string} values.eventType - Event type.
   * @param {string|null} [values.fromStatus] - Source status.
   * @param {string|null} [values.toStatus] - Destination status.
   * @param {number|null} [values.actorUserId] - Authenticated actor id.
   * @param {object|null} [values.metadata] - Optional JSON details.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object>} The created event.
   */
  function append(values, transaction) {
    return repository.createHistory(
      {
        order_id: values.orderId,
        event_type: values.eventType,
        from_status: values.fromStatus ?? null,
        to_status: values.toStatus ?? null,
        actor_user_id: values.actorUserId ?? null,
        metadata: values.metadata ?? null,
      },
      { transaction },
    );
  }

  /**
   * Builds the metadata of an item event.
   * @param {object} item - Order line.
   * @returns {{ order_item_id: number, product_id: number,
   *   item_state_id: number, quantity: number }} Event metadata.
   */
  function itemMetadata(item) {
    return {
      order_item_id: readField(item, "id"),
      product_id: readField(item, "product_id"),
      item_state_id: readField(item, "item_state_id"),
      quantity: readField(item, "quantity"),
    };
  }

  return { append, itemMetadata };
}

module.exports = { createOrderHistoryService };
