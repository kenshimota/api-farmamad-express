const { readField } = require("../shared/serializer");
const { EVENTS, MAX_ITEMS, ORDER_STATUSES } = require("./constants");
const {
  duplicatedItem,
  invalidItemState,
  itemLimitReached,
  orderItemNotFound,
  orderNotFound,
  orderNotEditable,
} = require("./errors");
const {
  calculateOrderTotals,
  toLineAmounts,
  toOrderAmounts,
} = require("./money");

/**
 * Creates the item service that edits the lines of a draft order.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {object} dependencies.access - Access helpers.
 * @param {object} dependencies.pricing - Pricing helper.
 * @param {object} dependencies.history - History helper.
 * @returns {object} The item service.
 */
function createOrderItemService({ repository, access, pricing, history }) {
  /**
   * Loads and locks a draft order and enforces the write access.
   * @param {number} orderId - Order id.
   * @param {object} context - Actor context.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object>} The locked order.
   */
  async function loadEditableOrder(orderId, context, transaction) {
    const order = await repository.findById(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw orderNotFound();
    }

    await access.assertEditAccess(order, context);

    if (readField(order, "status") !== ORDER_STATUSES.DRAFT) {
      throw orderNotEditable();
    }

    return order;
  }

  /**
   * Recomputes and persists the order totals from its stored lines.
   * @param {object} order - Locked order.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>}
   */
  async function recalculateTotals(order, transaction) {
    const items = await repository.listOrderItems(readField(order, "id"), {
      transaction,
    });
    const totals = calculateOrderTotals(
      items.map((item) => ({
        quantity: readField(item, "quantity"),
        unit_price: readField(item, "unit_price"),
        tax_rate: readField(item, "tax_rate"),
      })),
    );

    await repository.updateOrder(order, toOrderAmounts(totals), {
      transaction,
    });
  }

  return {
    /**
     * Adds a line to a draft order and snapshots its current price.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated line.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async addItem(orderId, input, actor) {
      const context = await access.resolveContext(actor);

      return repository.transaction(async (transaction) => {
        const order = await loadEditableOrder(orderId, context, transaction);
        const itemState = await repository.findItemStateById(
          input.item_state_id,
        );

        if (!itemState || readField(itemState, "is_sellable") !== true) {
          throw invalidItemState();
        }

        const existing = await repository.findOrderItemByPair(
          orderId,
          input.product_id,
          input.item_state_id,
          { transaction },
        );

        if (existing) {
          throw duplicatedItem();
        }

        const count = await repository.countOrderItems(orderId, {
          transaction,
        });

        if (Number(count) >= MAX_ITEMS) {
          throw itemLimitReached();
        }

        const priceListId = pricing.resolvePriceListId(order);
        const currency = await pricing.resolveOrderCurrency(order);
        const [priced] = await pricing.priceLines(
          [input],
          priceListId,
          currency,
        );
        const item = await repository.createOrderItem(
          {
            order_id: orderId,
            product_id: priced.product_id,
            item_state_id: priced.item_state_id,
            quantity: priced.quantity,
            ...toLineAmounts(priced),
          },
          { transaction },
        );

        await recalculateTotals(order, transaction);
        await history.append(
          {
            orderId,
            eventType: EVENTS.ITEM_ADDED,
            fromStatus: readField(order, "status"),
            toStatus: readField(order, "status"),
            actorUserId: context.userId,
            metadata: history.itemMetadata(item),
          },
          transaction,
        );

        return repository.findById(orderId, { transaction });
      });
    },

    /**
     * Updates only the quantity of a draft line; product and state are
     * immutable. The line is repriced with the current customer list.
     * @param {number} orderId - Order id.
     * @param {number} itemId - Line id.
     * @param {object} input - Validated body with `quantity`.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updateItem(orderId, itemId, input, actor) {
      const context = await access.resolveContext(actor);

      return repository.transaction(async (transaction) => {
        const order = await loadEditableOrder(orderId, context, transaction);
        const item = await repository.findOrderItem(orderId, itemId, {
          transaction,
        });

        if (!item) {
          throw orderItemNotFound();
        }

        const priceListId = pricing.resolvePriceListId(order);
        const currency = await pricing.resolveOrderCurrency(order);
        const [priced] = await pricing.priceLines(
          [
            {
              product_id: readField(item, "product_id"),
              item_state_id: readField(item, "item_state_id"),
              quantity: input.quantity,
            },
          ],
          priceListId,
          currency,
        );

        await repository.updateOrderItem(
          item,
          {
            quantity: priced.quantity,
            ...toLineAmounts(priced),
          },
          { transaction },
        );
        await recalculateTotals(order, transaction);
        await history.append(
          {
            orderId,
            eventType: EVENTS.ITEM_UPDATED,
            fromStatus: readField(order, "status"),
            toStatus: readField(order, "status"),
            actorUserId: context.userId,
            metadata: history.itemMetadata(item),
          },
          transaction,
        );

        return repository.findById(orderId, { transaction });
      });
    },

    /**
     * Removes a line from a draft order.
     * @param {number} orderId - Order id.
     * @param {number} itemId - Line id.
     * @param {object} actor - JWT payload.
     * @returns {Promise<void>}
     */
    async removeItem(orderId, itemId, actor) {
      const context = await access.resolveContext(actor);

      return repository.transaction(async (transaction) => {
        const order = await loadEditableOrder(orderId, context, transaction);
        const item = await repository.findOrderItem(orderId, itemId, {
          transaction,
        });

        if (!item) {
          throw orderItemNotFound();
        }

        const metadata = history.itemMetadata(item);

        await repository.removeOrderItem(item, { transaction });
        await recalculateTotals(order, transaction);
        await history.append(
          {
            orderId,
            eventType: EVENTS.ITEM_REMOVED,
            fromStatus: readField(order, "status"),
            toStatus: readField(order, "status"),
            actorUserId: context.userId,
            metadata,
          },
          transaction,
        );
      });
    },
  };
}

module.exports = { createOrderItemService };
