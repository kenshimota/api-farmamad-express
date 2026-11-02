const { Op } = require("sequelize");
const sequelize = require("../database");
const OrderStatus = require("../models/order-status");
const Order = require("../models/order");
const OrderHistory = require("../models/order-history");

const LIST_ORDER = Object.freeze([
  ["sort_order", "ASC"],
  ["id", "ASC"],
]);

/**
 * Creates the repository of the order-statuses module. Models and the
 * connection are injectable so the service can be unit tested.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - OrderStatus model.
 * @param {object} [options.orderModel] - Order model.
 * @param {object} [options.historyModel] - OrderHistory model.
 * @param {object} [options.db] - Sequelize instance.
 * @returns {object} Order status repository.
 */
function createOrderStatusRepository({
  model = OrderStatus,
  orderModel = Order,
  historyModel = OrderHistory,
  db = sequelize,
} = {}) {
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
     * Lists every status by `sort_order` and `id` ascending.
     * @returns {Promise<object[]>} The catalog.
     */
    findAll() {
      return model.findAll({ order: LIST_ORDER });
    },

    /**
     * Loads one status by primary key.
     * @param {number} id - Status id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The status or null.
     */
    findById(id, options = {}) {
      return model.findByPk(id, options);
    },

    /**
     * Loads one status by its stable code.
     * @param {string} code - Status code.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The status or null.
     */
    findByCode(code, options = {}) {
      return model.findOne({ where: { code }, ...options });
    },

    /**
     * Persists a new status.
     * @param {object} values - Status attributes.
     * @returns {Promise<object>} The created status.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Tells whether a status is referenced by an order, an order history row
     * or as the `next_status_code` of another status.
     * @param {number} id - Status id.
     * @param {string} code - Status code.
     * @returns {Promise<boolean>} True when it cannot be deleted.
     */
    async isInUse(id, code) {
      const [orders, fromStatus, toStatus, references] = await Promise.all([
        orderModel.count({ where: { status: code } }),
        historyModel.count({ where: { from_status: code } }),
        historyModel.count({ where: { to_status: code } }),
        model.count({ where: { next_status_code: code, id: { [Op.ne]: id } } }),
      ]);

      return orders + fromStatus + toStatus + references > 0;
    },

    /**
     * Counts how many of the requested codes exist.
     * @param {string[]} codes - Codes to check.
     * @returns {Promise<number>} Number of existing codes.
     */
    countCodes(codes) {
      return model.count({ where: { code: { [Op.in]: [...codes] } } });
    },

    /**
     * Deletes one status row.
     * @param {object} status - Loaded status instance.
     * @returns {Promise<void>} Resolves once removed.
     */
    remove(status) {
      return status.destroy();
    },
  };
}

const orderStatusRepository = createOrderStatusRepository();

module.exports = {
  LIST_ORDER,
  createOrderStatusRepository,
  orderStatusRepository,
};
