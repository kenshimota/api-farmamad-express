const { Op, QueryTypes, Sequelize } = require("sequelize");
const sequelize = require("../database");
const Order = require("../models/order");
const OrderItem = require("../models/order-item");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const OrderHistory = require("../models/order-history");
const Customer = require("../models/customer");
const User = require("../models/user");
const Lot = require("../models/lot");
const { buildOrderIncludes } = require("./includes");
const { createOrderLifecycleRepository } = require("./lifecycle-repository");
const { createOrderItemRepository } = require("./item-repository");

/**
 * Creates the core repository of the orders module: header, lines, history and
 * lot reservation primitives. Models and the connection are injectable so the
 * abstraction stays testable without a database.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Order model.
 * @param {object} [options.itemModel] - OrderItem model.
 * @param {object} [options.allocationModel] - Allocation model.
 * @param {object} [options.historyModel] - OrderHistory model.
 * @param {object} [options.userModel] - User model.
 * @param {object} [options.customerModel] - Customer model.
 * @param {object} [options.lotModel] - Lot model.
 * @param {object} [options.db] - Shared Sequelize instance.
 * @returns {object} Order repository.
 */
function createBaseOrderRepository({
  model = Order,
  itemModel = OrderItem,
  allocationModel = OrderItemLotAllocation,
  historyModel = OrderHistory,
  userModel = User,
  customerModel = Customer,
  lotModel = Lot,
  db = sequelize,
} = {}) {
  /**
   * Loads one order with its public relations.
   * @param {number} id - Order id.
   * @param {object} [options] - Query options.
   * @param {boolean} [options.includeItems] - Nest the lines.
   * @param {boolean} [options.includeHistory] - Nest the history.
   * @param {object} [options.transaction] - Open transaction.
   * @param {string} [options.lock] - Row lock mode.
   * @returns {Promise<object|null>} The loaded order or null.
   */
  async function findById(
    id,
    {
      includeItems = true,
      includeHistory = true,
      includeCustomer = true,
      includeCurrency = true,
      includePaymentTerm = true,
      transaction,
      lock,
    } = {},
  ) {
    if (lock) {
      // PostgreSQL rejects `FOR UPDATE` on the nullable side of the outer
      // joins used by the includes, so the order row is locked on its own and
      // the relations are loaded in a second query inside the same transaction.
      const locked = await model.findByPk(id, {
        attributes: ["id"],
        lock,
        transaction,
      });

      if (!locked) {
        return null;
      }
    }

    return model.findByPk(id, {
      include: buildOrderIncludes({
        includeItems,
        includeHistory,
        includeCustomer,
        includeCurrency,
        includePaymentTerm,
      }),
      transaction,
    });
  }

  return {
    /**
     * Runs a callback inside a database transaction.
     * @param {(transaction: object) => Promise<unknown>} callback - Work.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return db.transaction(callback);
    },

    /**
     * Finds the authenticated user by id.
     * @param {number} id - User id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The user or null.
     */
    findUserById(id, options) {
      return options ? userModel.findByPk(id, options) : userModel.findByPk(id);
    },

    /**
     * Finds a customer by id.
     * @param {number} id - Customer id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The customer or null.
     */
    findCustomerById(id, options) {
      return options
        ? customerModel.findByPk(id, options)
        : customerModel.findByPk(id);
    },

    /**
     * Reserves the next ascending order number from the PostgreSQL sequence.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<number>} The reserved number.
     */
    async nextNumber(transaction) {
      const [row] = await db.query(
        "SELECT nextval('orders_number_seq') AS \"number\"",
        { type: QueryTypes.SELECT, transaction },
      );

      return Number(row.number);
    },

    /**
     * Loads and locks the lots of one product/state pair with availability,
     * ordered FEFO.
     * @param {number} productId - Product id.
     * @param {number} itemStateId - Item state id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object[]>} The locked lots.
     */
    findLotsForUpdate(productId, itemStateId, transaction) {
      return lotModel.findAll({
        where: {
          product_id: productId,
          item_state_id: itemStateId,
          stock: { [Op.gt]: Sequelize.col("reserved") },
        },
        order: [
          ["expiration_date", "ASC"],
          ["id", "ASC"],
        ],
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
    },

    /**
     * Increments `lots.reserved` for an already locked lot.
     * @param {object} lot - Locked lot instance.
     * @param {number} quantity - Units to reserve.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The updated lot.
     */
    reserveLot(lot, quantity, transaction) {
      return lot.update(
        { reserved: Number(lot.reserved) + Number(quantity) },
        { transaction },
      );
    },

    /**
     * Persists the order header.
     * @param {object} values - Order attributes.
     * @param {object} [options] - Persistence options.
     * @returns {Promise<object>} The created order.
     */
    createOrder(values, { transaction } = {}) {
      return model.create(values, { transaction });
    },

    /**
     * Persists order lines.
     * @param {object[]} rows - Line values.
     * @param {object} [options] - Persistence options.
     * @returns {Promise<object[]>} The created lines.
     */
    createItems(rows, { transaction } = {}) {
      return itemModel.bulkCreate(rows, { transaction });
    },

    /**
     * Updates an order instance.
     * @param {object} order - Loaded order.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object>} The updated order.
     */
    updateOrder(order, values, options = {}) {
      return order.update(values, options);
    },

    /**
     * Persists the lot allocations of the reserved lines.
     * @param {object[]} rows - Allocation values.
     * @param {object} [options] - Persistence options.
     * @returns {Promise<object[]>} The created allocations.
     */
    createAllocations(rows, { transaction } = {}) {
      return allocationModel.bulkCreate(rows, { transaction });
    },

    /**
     * Appends one event to the order history.
     * @param {object} values - Event values.
     * @param {object} [options] - Persistence options.
     * @returns {Promise<object>} The created event.
     */
    createHistory(values, { transaction } = {}) {
      return historyModel.create(values, { transaction });
    },

    /**
     * Replaces the payment term snapshot of an order.
     * @param {object} order - Loaded order.
     * @param {number} paymentTermId - Active payment term id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object>} The updated order.
     */
    updatePaymentTerm(order, paymentTermId, options) {
      return options
        ? order.update({ payment_term_id: paymentTermId }, options)
        : order.update({ payment_term_id: paymentTermId });
    },

    findById,
  };
}

/**
 * Creates the full orders repository by composing the core persistence methods
 * with the lifecycle queries.
 * @param {object} [options] - Injectable dependencies.
 * @returns {object} The orders repository.
 */
function createOrderRepository(options = {}) {
  return {
    ...createBaseOrderRepository(options),
    ...createOrderItemRepository(options),
    ...createOrderLifecycleRepository(options),
  };
}

const orderRepository = createOrderRepository();

module.exports = {
  createBaseOrderRepository,
  createOrderRepository,
  orderRepository,
};
