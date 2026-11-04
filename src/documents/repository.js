const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const Order = require("../models/order");

/**
 * Creates the read-only repository used by the PDF documents. It only loads
 * currency configuration and the order number needed by an invoice; the order
 * and invoice data themselves come from the existing services.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.currencyModel] - Currency model.
 * @param {object} [options.rateHistoryModel] - Currency rate history model.
 * @param {object} [options.orderModel] - Order model.
 * @returns {object} The document repository.
 */
function createDocumentRepository({
  currencyModel = Currency,
  rateHistoryModel = CurrencyRateHistory,
  orderModel = Order,
} = {}) {
  return {
    /**
     * Loads a currency by primary key, including inactive ones.
     * @param {number} id - Currency id.
     * @returns {Promise<object|null>} The currency or null.
     */
    findCurrencyById(id) {
      return currencyModel.findByPk(id);
    },

    /**
     * Loads the configured base currency.
     * @returns {Promise<object|null>} The base currency or null.
     */
    findBaseCurrency() {
      return currencyModel.findOne({ where: { is_base: true } });
    },

    /**
     * Loads the newest rate change of a currency.
     * @param {number} currencyId - Currency id.
     * @returns {Promise<object|null>} The newest history row or null.
     */
    findLatestRateChange(currencyId) {
      return rateHistoryModel.findOne({
        where: { currency_id: currencyId },
        order: [
          ["changed_at", "DESC"],
          ["id", "DESC"],
        ],
        attributes: ["changed_at"],
      });
    },

    /**
     * Loads only the number of an order.
     * @param {number} id - Order id.
     * @returns {Promise<object|null>} The order projection or null.
     */
    findOrderNumber(id) {
      return orderModel.findByPk(id, { attributes: ["id", "number"] });
    },
  };
}

const documentRepository = createDocumentRepository();

module.exports = { createDocumentRepository, documentRepository };
