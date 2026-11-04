const { Op, Sequelize } = require("sequelize");
const Stock = require("../models/stock");
const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const Lot = require("../models/lot");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { createPurchaseStockService } = require("./purchase-service");
const { findPage } = require("../shared/pagination");

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
const LOW_STOCK_THRESHOLD = 10;
const SORT_FIELDS = Object.freeze([
  "id",
  "product_id",
  "item_state_id",
  "quantity",
]);

/**
 * Creates a repository that encapsulates every read query of the stocks
 * module and exposes the transactional increment used by purchases. The
 * models are injectable to keep the abstraction testable.
 * @param {object} [model] - Stock model used for the queries.
 * @param {object} [itemStateModel] - Item state model used for the includes.
 * @param {object} [costModel] - Cost model joined by the available view.
 * @param {object} [purchaseService] - Service that applies purchase items.
 * @param {object} [currencyModel] - Currency model nested in the current cost.
 * @param {object} [lotModel] - Lot model used to aggregate located stock.
 * @returns {object} Stock repository.
 */
function createStockRepository(
  model = Stock,
  itemStateModel = ItemState,
  costModel = Cost,
  purchaseService = createPurchaseStockService(model),
  currencyModel = Currency,
  lotModel = Lot,
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
    list(
      { productId, itemStateId, inStock, warehouseId, lowStock } = {},
      { pagination, order = LIST_ORDER } = {},
    ) {
      const options = { order, include: [itemStateInclude] };
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

      if (lowStock !== undefined) {
        where.quantity = lowStock
          ? { [Op.gt]: 0, [Op.lte]: LOW_STOCK_THRESHOLD }
          : { [Op.gt]: LOW_STOCK_THRESHOLD };
      }

      if (warehouseId !== undefined) {
        options.include.push({
          model: lotModel,
          as: "warehouse_lots",
          attributes: [],
          required: true,
          where: { warehouse_id: warehouseId },
          on: {
            [Op.and]: [
              Sequelize.where(
                Sequelize.col("Stock.product_id"),
                Op.eq,
                Sequelize.col("warehouse_lots.product_id"),
              ),
              Sequelize.where(
                Sequelize.col("Stock.item_state_id"),
                Op.eq,
                Sequelize.col("warehouse_lots.item_state_id"),
              ),
            ],
          },
        });
      }

      if (Reflect.ownKeys(where).length > 0) {
        options.where = where;
      }

      return findPage(model, options, pagination);
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
            attributes: ["product_id", "item_state_id", "cost", "currency_id"],
            required: false,
            include: [
              {
                model: currencyModel,
                as: "currency",
                attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
              },
            ],
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
     * Aggregates the located stock of one product per item state. Only lots
     * with `location_status = 'located'` and a non-expired `expiration_date`
     * are sellable; pending, in-progress or expired lots never contribute to
     * this map, even before the daily job changes their state.
     * @param {number} productId - Product id.
     * @returns {Promise<Map<number, number>>} Item state id to located units.
     */
    async getLocatedQuantities(productId) {
      const rows = await lotModel.findAll({
        attributes: [
          "item_state_id",
          [Sequelize.fn("SUM", Sequelize.col("stock")), "total"],
        ],
        where: {
          product_id: productId,
          location_status: "located",
          expiration_date: { [Op.gte]: Sequelize.literal("CURRENT_DATE") },
        },
        group: ["item_state_id"],
        raw: true,
      });

      return new Map(
        rows.map((row) => [Number(row.item_state_id), Number(row.total)]),
      );
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
  LOW_STOCK_THRESHOLD,
  PRODUCT_LIST_ORDER,
  SORT_FIELDS,
  createStockRepository,
  stockRepository,
};
