const { Op, Sequelize } = require("sequelize");
const Stock = require("../models/stock");
const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const { createPurchaseStockService } = require("./purchase-service");

const ITEM_STATE_ATTRIBUTES = Object.freeze([
  "id",
  "name",
  "label",
  "is_sellable",
]);
const LIST_ORDER = Object.freeze([
  ["product_id", "ASC"],
  ["item_state_id", "ASC"],
]);
const PRODUCT_LIST_ORDER = Object.freeze([["item_state_id", "ASC"]]);

/**
 * Creates a repository that encapsulates every read query of the stocks
 * module and exposes the transactional increment used by purchases. The
 * models are injectable to keep the abstraction testable.
 * @param {object} [model] - Stock model used for the queries.
 * @param {object} [itemStateModel] - Item state model used for the includes.
 * @param {object} [costModel] - Cost model joined by the available view.
 * @param {object} [purchaseService] - Service that applies purchase items.
 * @returns {object} Stock repository.
 */
function createStockRepository(
  model = Stock,
  itemStateModel = ItemState,
  costModel = Cost,
  purchaseService = createPurchaseStockService(model),
) {
  const itemStateInclude = {
    model: itemStateModel,
    as: "item_state",
    attributes: [...ITEM_STATE_ATTRIBUTES],
  };

  return {
    /**
     * Lists stocks ordered by product and item state, optionally filtered.
     * @param {object} [filters] - Listing filters.
     * @param {number} [filters.productId] - Exact product id.
     * @param {number} [filters.itemStateId] - Exact item state id.
     * @param {boolean} [filters.inStock] - True for quantity > 0, false for 0.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ productId, itemStateId, inStock } = {}) {
      const options = { order: LIST_ORDER, include: [itemStateInclude] };
      const where = {};

      if (productId !== undefined) {
        where.product_id = productId;
      }

      if (itemStateId !== undefined) {
        where.item_state_id = itemStateId;
      }

      if (inStock !== undefined) {
        where.quantity = inStock ? { [Op.gt]: 0 } : { [Op.eq]: 0 };
      }

      if (Object.keys(where).length > 0) {
        options.where = where;
      }

      return model.findAll(options);
    },

    /**
     * Lists every stock row of one product ordered by item state.
     * @param {number} productId - Product id.
     * @returns {Promise<object[]>} The matching instances.
     */
    listByProduct(productId) {
      return model.findAll({
        where: { product_id: productId },
        order: PRODUCT_LIST_ORDER,
        include: [itemStateInclude],
      });
    },

    /**
     * Finds a stock by primary key including the documented item state fields.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id, { include: [itemStateInclude] });
    },

    /**
     * Lists the sellable stock of one product with quantity greater than zero
     * and its current cost (or null). Stocks, item states and costs are
     * resolved in a single Sequelize query with an eager join, so there is no
     * N+1 behavior.
     * @param {number} productId - Product id.
     * @returns {Promise<object[]>} The available instances ordered by item
     *   state name.
     */
    listAvailable(productId) {
      return model.findAll({
        where: {
          product_id: productId,
          quantity: { [Op.gt]: 0 },
        },
        order: [[{ model: itemStateModel, as: "item_state" }, "name", "ASC"]],
        include: [
          {
            ...itemStateInclude,
            required: true,
            where: { is_sellable: true },
          },
          {
            model: costModel,
            as: "cost",
            attributes: ["product_id", "item_state_id", "cost"],
            required: false,
            on: {
              [Op.and]: [
                Sequelize.where(
                  Sequelize.col("Stock.product_id"),
                  Op.eq,
                  Sequelize.col("cost.product_id"),
                ),
                Sequelize.where(
                  Sequelize.col("Stock.item_state_id"),
                  Op.eq,
                  Sequelize.col("cost.item_state_id"),
                ),
              ],
            },
          },
        ],
      });
    },

    /**
     * Applies confirmed purchase items to the stock inside the received
     * transaction.
     * @param {object[]} items - Purchase items to apply.
     * @param {object} options - Options with the open transaction.
     * @returns {Promise<object[]>} The touched stock instances.
     */
    applyPurchaseItems(items, options) {
      return purchaseService.applyPurchaseItems(items, options);
    },
  };
}

const stockRepository = createStockRepository();

module.exports = {
  ITEM_STATE_ATTRIBUTES,
  LIST_ORDER,
  PRODUCT_LIST_ORDER,
  createStockRepository,
  stockRepository,
};
