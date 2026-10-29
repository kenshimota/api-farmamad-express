const Cost = require("../models/cost");
const Product = require("../models/product");
const ItemState = require("../models/item-state");

const LIST_ORDER = Object.freeze([
  ["product_id", "ASC"],
  ["item_state_id", "ASC"],
]);
const ITEM_STATE_ATTRIBUTES = Object.freeze([
  "id",
  "name",
  "label",
  "is_sellable",
]);

/**
 * Creates a repository that encapsulates every persistence call for the costs
 * module, including the existence checks of its foreign keys. The models are
 * injectable to keep the abstraction testable.
 * @param {object} [model] - Cost model used for the queries.
 * @param {object} [productModel] - Product model used for the checks.
 * @param {object} [itemStateModel] - Item state model used for the checks and
 *   for the nested include.
 * @returns {object} Cost repository.
 */
function createCostRepository(
  model = Cost,
  productModel = Product,
  itemStateModel = ItemState,
) {
  const include = [
    {
      model: itemStateModel,
      as: "item_state",
      attributes: [...ITEM_STATE_ATTRIBUTES],
    },
  ];

  /**
   * Finds a cost by primary key including the documented item state fields.
   * @param {number} id - Positive integer id.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(id) {
    return model.findByPk(id, { include });
  }

  return {
    /**
     * Persists a new cost and reloads it with its item state.
     * @param {object} values - Validated cost attributes.
     * @returns {Promise<object>} The created instance with the include.
     */
    async create(values) {
      const created = await model.create(values);

      return findById(created.id);
    },

    /**
     * Lists costs ordered by product and item state, optionally filtered.
     * @param {object} [filters] - Listing filters.
     * @param {number} [filters.productId] - Exact product id.
     * @param {number} [filters.itemStateId] - Exact item state id.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ productId, itemStateId } = {}) {
      const options = { order: LIST_ORDER, include };
      const where = {};

      if (productId !== undefined) {
        where.product_id = productId;
      }

      if (itemStateId !== undefined) {
        where.item_state_id = itemStateId;
      }

      if (Object.keys(where).length > 0) {
        options.where = where;
      }

      return model.findAll(options);
    },

    /**
     * Lists every cost of one product ordered by item state.
     * @param {number} productId - Product id.
     * @returns {Promise<object[]>} The matching instances.
     */
    listByProduct(productId) {
      return model.findAll({
        where: { product_id: productId },
        order: LIST_ORDER,
        include,
      });
    },

    findById,

    /**
     * Persists changes on an existing instance and reloads it so the nested
     * item state reflects a possible reference change.
     * @param {object} cost - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance with the include.
     */
    async update(cost, values) {
      await cost.update(values);

      return findById(cost.id);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} cost - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(cost) {
      return cost.destroy();
    },

    /**
     * Tells whether a product exists without relying on raw SQL.
     * @param {number} id - Product id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async productExists(id) {
      const product = await productModel.findByPk(id);

      return product !== null && product !== undefined;
    },

    /**
     * Tells whether an item state exists without relying on raw SQL.
     * @param {number} id - Item state id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async itemStateExists(id) {
      const itemState = await itemStateModel.findByPk(id);

      return itemState !== null && itemState !== undefined;
    },
  };
}

const costRepository = createCostRepository();

module.exports = {
  ITEM_STATE_ATTRIBUTES,
  LIST_ORDER,
  createCostRepository,
  costRepository,
};
