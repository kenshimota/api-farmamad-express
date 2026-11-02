const { Op, QueryTypes, Sequelize } = require("sequelize");
const sequelize = require("../database");
const Order = require("../models/order");
const OrderItem = require("../models/order-item");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const OrderHistory = require("../models/order-history");
const Customer = require("../models/customer");
const User = require("../models/user");
const Currency = require("../models/currency");
const Lot = require("../models/lot");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

const ITEM_ORDER = Object.freeze([["id", "ASC"]]);
const HISTORY_ORDER = Object.freeze([
  ["createdAt", "ASC"],
  ["id", "ASC"],
]);
const ITEM_INCLUDE = Object.freeze({
  model: OrderItem,
  as: "items",
  separate: true,
  order: ITEM_ORDER,
  include: [
    {
      model: Product,
      as: "product",
      attributes: ["id", "name", "reference", "image_id"],
    },
    {
      model: ItemState,
      as: "item_state",
      attributes: ["id", "name", "label"],
    },
  ],
});
const HISTORY_INCLUDE = Object.freeze({
  model: OrderHistory,
  as: "history",
  separate: true,
  order: HISTORY_ORDER,
});
const CUSTOMER_INCLUDE = Object.freeze({
  model: Customer,
  as: "customer",
  attributes: ["id", "fullName", "email", "direction"],
});
const CURRENCY_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
});

/**
 * Creates the repository that encapsulates every persistence call of the
 * orders module. The models and the Sequelize instance are injectable so the
 * service and the abstraction stay testable without a real database.
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
function createOrderRepository({
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
   * @param {object} [options.transaction] - Open transaction.
   * @returns {Promise<object|null>} The loaded order or null.
   */
  function findById(id, { transaction } = {}) {
    return model.findByPk(id, {
      include: [
        { ...CUSTOMER_INCLUDE },
        { ...CURRENCY_INCLUDE },
        { ...ITEM_INCLUDE },
        { ...HISTORY_INCLUDE },
      ],
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
     * @returns {Promise<object|null>} The user or null.
     */
    findUserById(id) {
      return userModel.findByPk(id);
    },

    /**
     * Finds the customer linked to the authenticated user.
     * @param {number} id - Customer id.
     * @returns {Promise<object|null>} The customer or null.
     */
    findCustomerById(id) {
      return customerModel.findByPk(id);
    },

    /**
     * Reserves the next ascending order number from the PostgreSQL sequence.
     * `sequelize.query` is used instead of the raw `pg` driver so the call
     * participates in the current transaction.
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
     * Loads and locks the lots of one product/state pair that still have
     * available units, ordered FEFO. `FOR UPDATE` serializes concurrent orders
     * so the last unit can only be reserved once.
     * @param {number} productId - Product id.
     * @param {number} itemStateId - Item state id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object[]>} The locked lots ordered by expiration/id.
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
     * @param {object} options - Persistence options.
     * @param {object} options.transaction - Open transaction.
     * @returns {Promise<object>} The created order.
     */
    createOrder(values, { transaction } = {}) {
      return model.create(values, { transaction });
    },

    /**
     * Persists the order lines.
     * @param {object[]} rows - Line values.
     * @param {object} options - Persistence options.
     * @param {object} options.transaction - Open transaction.
     * @returns {Promise<object[]>} The created lines in input order.
     */
    createItems(rows, { transaction } = {}) {
      return itemModel.bulkCreate(rows, { transaction });
    },

    /**
     * Persists the lot allocations of the created lines.
     * @param {object[]} rows - Allocation values.
     * @param {object} options - Persistence options.
     * @param {object} options.transaction - Open transaction.
     * @returns {Promise<object[]>} The created allocations.
     */
    createAllocations(rows, { transaction } = {}) {
      return allocationModel.bulkCreate(rows, { transaction });
    },

    /**
     * Appends one event to the order history.
     * @param {object} values - Event values.
     * @param {object} options - Persistence options.
     * @param {object} options.transaction - Open transaction.
     * @returns {Promise<object>} The created event.
     */
    createHistory(values, { transaction } = {}) {
      return historyModel.create(values, { transaction });
    },

    findById,
  };
}

const orderRepository = createOrderRepository();

module.exports = {
  CURRENCY_INCLUDE,
  CUSTOMER_INCLUDE,
  HISTORY_INCLUDE,
  HISTORY_ORDER,
  ITEM_INCLUDE,
  ITEM_ORDER,
  createOrderRepository,
  orderRepository,
};
