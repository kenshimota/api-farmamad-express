const OrderItem = require("../models/order-item");

/**
 * Creates the repository fragment that manages order lines. It is merged into
 * `createOrderRepository` so the main repository stays small.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.itemModel] - OrderItem model.
 * @returns {object} Line persistence methods.
 */
function createOrderItemRepository({ itemModel = OrderItem } = {}) {
  return {
    /**
     * Persists one order line.
     * @param {object} values - Line attributes.
     * @param {object} [options] - Persistence options.
     * @returns {Promise<object>} The created line.
     */
    createOrderItem(values, { transaction } = {}) {
      return itemModel.create(values, { transaction });
    },

    /**
     * Lists the lines of an order ordered by id.
     * @param {number} orderId - Order id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object[]>} The lines.
     */
    listOrderItems(orderId, options = {}) {
      return itemModel.findAll({
        where: { order_id: orderId },
        order: [["id", "ASC"]],
        ...options,
      });
    },

    /**
     * Loads one line of an order.
     * @param {number} orderId - Order id.
     * @param {number} itemId - Line id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The line or null.
     */
    findOrderItem(orderId, itemId, options = {}) {
      return itemModel.findOne({
        where: { id: itemId, order_id: orderId },
        ...options,
      });
    },

    /**
     * Finds a line by its unique product/state pair.
     * @param {number} orderId - Order id.
     * @param {number} productId - Product id.
     * @param {number} itemStateId - Item state id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The line or null.
     */
    findOrderItemByPair(orderId, productId, itemStateId, options = {}) {
      return itemModel.findOne({
        where: {
          order_id: orderId,
          product_id: productId,
          item_state_id: itemStateId,
        },
        ...options,
      });
    },

    /**
     * Counts the lines of an order.
     * @param {number} orderId - Order id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<number>} The number of lines.
     */
    countOrderItems(orderId, options = {}) {
      return itemModel.count({ where: { order_id: orderId }, ...options });
    },

    /**
     * Updates an order line instance.
     * @param {object} item - Loaded line.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object>} The updated line.
     */
    updateOrderItem(item, values, options = {}) {
      return item.update(values, options);
    },

    /**
     * Removes an order line.
     * @param {object} item - Loaded line.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<void>} Resolves once removed.
     */
    removeOrderItem(item, options = {}) {
      return item.destroy(options);
    },
  };
}

module.exports = { createOrderItemRepository };
