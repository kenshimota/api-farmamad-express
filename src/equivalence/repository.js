const { Op } = require("sequelize");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const Order = require("../models/order");

/**
 * Creates the read-only repository used by the equivalence service. It owns
 * only the currency, rate-history and order-number lookups; orders and
 * invoices are loaded through their existing services so the access rules are
 * reused.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.currencyModel] - Currency model.
 * @param {object} [options.historyModel] - CurrencyHistory model.
 * @param {object} [options.orderModel] - Order model.
 * @returns {object} The equivalence repository.
 */
function createEquivalenceRepository({
  currencyModel = Currency,
  historyModel = CurrencyRateHistory,
  orderModel = Order,
} = {}) {
  return {
    /**
     * Loads one currency by primary key, active or not.
     * @param {number} id - Currency id.
     * @returns {Promise<object|null>} The currency or null.
     */
    findCurrencyById(id) {
      return currencyModel.findByPk(id);
    },

    /**
     * Loads the single currency flagged as base.
     * @returns {Promise<object|null>} The base currency or null.
     */
    findBaseCurrency() {
      return currencyModel.findOne({ where: { is_base: true } });
    },

    /**
     * Loads the most recent rate change of each requested currency.
     * @param {number[]} currencyIds - Currency ids, duplicates allowed.
     * @returns {Promise<Record<number, Date>>} Last change per currency id.
     */
    async findLatestRateChanges(currencyIds) {
      const ids = [...new Set(currencyIds.filter(Boolean))];

      if (ids.length === 0) {
        return {};
      }

      const rows = await historyModel.findAll({
        where: { currency_id: { [Op.in]: ids } },
        order: [
          ["changed_at", "DESC"],
          ["id", "DESC"],
        ],
      });
      const latest = {};

      for (const row of rows) {
        const currencyId = Number(row.currency_id);

        if (latest[currencyId] === undefined) {
          latest[currencyId] = row.changed_at;
        }
      }

      return latest;
    },

    /**
     * Loads the public number of the order linked to an invoice.
     * @param {number|null} orderId - Order id.
     * @returns {Promise<number|null>} The order number or null.
     */
    async findOrderNumber(orderId) {
      if (orderId === null || orderId === undefined) {
        return null;
      }

      const order = await orderModel.findByPk(orderId, {
        attributes: ["id", "number"],
      });

      return order ? Number(order.number) : null;
    },
  };
}

const equivalenceRepository = createEquivalenceRepository();

module.exports = { createEquivalenceRepository, equivalenceRepository };
