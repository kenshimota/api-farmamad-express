const { Op } = require("sequelize");
const sequelize = require("../database");
const OrderItem = require("../models/order-item");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const Lot = require("../models/lot");
const Stock = require("../models/stock");
const ItemState = require("../models/item-state");
const PaymentTerm = require("../models/payment-term");
const CustomerWallet = require("../models/customer-wallet");
const CustomerSeller = require("../models/customer-seller");
const Currency = require("../models/currency");
const OrderStatus = require("../models/order-status");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { buildOrderIncludes } = require("./includes");

const LIST_ORDER = Object.freeze([
  ["createdAt", "DESC"],
  ["id", "DESC"],
]);
const WALLET_INCLUDE = Object.freeze({
  model: Currency,
  as: "currency",
  attributes: ["id", "code", "rate", "is_active"],
});

/**
 * Creates the lifecycle repository: queries used by draft editing,
 * transitions, wallet checks and reservation release/consumption. It is merged
 * with the core repository by `createOrderRepository`.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.itemModel] - OrderItem model.
 * @param {object} [options.allocationModel] - Allocation model.
 * @param {object} [options.lotModel] - Lot model.
 * @param {object} [options.stockModel] - Stock model.
 * @param {object} [options.itemStateModel] - Item state model.
 * @param {object} [options.paymentTermModel] - Payment term model.
 * @param {object} [options.walletModel] - Wallet model.
 * @param {object} [options.customerSellerModel] - CustomerSeller model.
 * @param {object} [options.statusModel] - OrderStatus model.
 * @param {object} [options.db] - Shared Sequelize instance.
 * @returns {object} Lifecycle repository methods.
 */
function createOrderLifecycleRepository({
  model,
  itemModel = OrderItem,
  allocationModel = OrderItemLotAllocation,
  lotModel = Lot,
  stockModel = Stock,
  itemStateModel = ItemState,
  paymentTermModel = PaymentTerm,
  walletModel = CustomerWallet,
  customerSellerModel = CustomerSeller,
  statusModel = OrderStatus,
  db = sequelize,
} = {}) {
  return {
    /**
     * Lists orders with their public relations, newest first.
     * @param {object} [filters] - Exact filters.
     * @param {number} [filters.customerId] - Customer scope.
     * @returns {Promise<object[]>} The matching orders.
     */
    findOrders({ customerId } = {}) {
      const options = {
        order: LIST_ORDER,
        include: buildOrderIncludes({ includeHistory: false }),
      };

      if (customerId !== undefined) {
        options.where = { customer_id: customerId };
      }

      return (model ?? require("../models/order")).findAll(options);
    },

    /**
     * Loads one item state.
     * @param {number} id - Item state id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The state or null.
     */
    findItemStateById(id, options = {}) {
      return itemStateModel.findByPk(id, options);
    },

    /**
     * Loads one payment term.
     * @param {number} id - Payment term id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The term or null.
     */
    findPaymentTermById(id, options = {}) {
      return paymentTermModel.findByPk(id, options);
    },

    /**
     * Finds the assignment of a customer to a seller.
     * @param {number} customerId - Customer id.
     * @param {number} sellerId - Seller user id.
     * @returns {Promise<object|null>} The assignment or null.
     */
    findCustomerSeller(customerId, sellerId) {
      return customerSellerModel.findOne({
        where: { customer_id: customerId, seller_id: sellerId },
      });
    },

    /**
     * Counts how many of the requested status codes exist.
     * @param {string[]} codes - Status codes.
     * @returns {Promise<number>} Number of existing codes.
     */
    countOrderStatusCodes(codes) {
      return statusModel.count({ where: { code: { [Op.in]: [...codes] } } });
    },

    /**
     * Loads one status by code.
     * @param {string} code - Status code.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The status or null.
     */
    findOrderStatusByCode(code, options = {}) {
      return statusModel.findOne({ where: { code }, ...options });
    },

    /**
     * Lists every wallet of a customer including its currency.
     * @param {number} customerId - Customer id.
     * @param {object} [transaction] - Open transaction.
     * @returns {Promise<object[]>} The wallets.
     */
    listWallets(customerId, transaction) {
      return walletModel.findAll({
        where: { customer_id: customerId },
        include: [{ ...WALLET_INCLUDE }],
        transaction,
      });
    },

    /**
     * Loads the active reservations of an order with their lots.
     * @param {number} orderId - Order id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object[]>} The allocations.
     */
    findReservedAllocations(orderId, transaction) {
      return allocationModel.findAll({
        where: { status: "reserved" },
        include: [
          {
            model: itemModel,
            as: "order_item",
            attributes: ["id"],
            where: { order_id: orderId },
          },
          {
            model: lotModel,
            as: "lot",
            attributes: [
              "id",
              "stock",
              "reserved",
              "product_id",
              "item_state_id",
            ],
          },
        ],
        transaction,
      });
    },

    /**
     * Locks a set of lots for update.
     * @param {number[]} ids - Lot ids.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object[]>} The locked lots.
     */
    lockLots(ids, transaction) {
      if (ids.length === 0) {
        return Promise.resolve([]);
      }

      return lotModel.findAll({
        where: { id: { [Op.in]: [...ids] } },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
    },

    /**
     * Updates a lot instance.
     * @param {object} lot - Loaded lot.
     * @param {object} values - Attributes to update.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The updated lot.
     */
    updateLot(lot, values, transaction) {
      return lot.update(values, { transaction });
    },

    /**
     * Updates an allocation instance.
     * @param {object} allocation - Loaded allocation.
     * @param {object} values - Attributes to update.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The updated allocation.
     */
    updateAllocation(allocation, values, transaction) {
      return allocation.update(values, { transaction });
    },

    /**
     * Locks the aggregate stock row of a product/state pair.
     * @param {number} productId - Product id.
     * @param {number} itemStateId - Item state id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked stock or null.
     */
    findStockForUpdate(productId, itemStateId, transaction) {
      return stockModel.findOne({
        where: { product_id: productId, item_state_id: itemStateId },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
    },

    /**
     * Updates an aggregate stock row.
     * @param {object} stock - Loaded stock.
     * @param {number} quantity - New quantity.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The updated stock.
     */
    updateStock(stock, quantity, transaction) {
      return stock.update({ quantity }, { transaction });
    },

    /**
     * Currency summary attributes used by the wallet include.
     * @returns {string[]} Attribute names.
     */
    currencyAttributes() {
      return [...CURRENCY_SUMMARY_ATTRIBUTES];
    },

    db,
  };
}

module.exports = {
  LIST_ORDER,
  createOrderLifecycleRepository,
};
