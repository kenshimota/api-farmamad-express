const ItemState = require("../models/item-state");

const LIST_ORDER = Object.freeze([["name", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call for the
 * item-states module. The models are injectable to keep the abstraction
 * testable.
 * @param {object} [model] - Sequelize model used for the queries.
 * @param {object} [costModel] - Cost model used for the reference check; it
 *   is loaded on demand so item state unit tests never need the cost model.
 * @param {object} [stockModel] - Stock model used for the reference check; it
 *   is loaded on demand so item state unit tests never need the stock model.
 * @returns {object} Item state repository.
 */
function createItemStateRepository(model = ItemState, costModel, stockModel) {
  return {
    /**
     * Persists a new item state.
     * @param {object} values - Validated item state attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists item states ordered by name ascending, optionally filtered by the
     * sellable flag.
     * @param {object} [filters] - Listing filters.
     * @param {boolean} [filters.isSellable] - Exact sellable flag.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ isSellable } = {}) {
      const options = { order: LIST_ORDER };

      if (isSellable !== undefined) {
        options.where = { is_sellable: isSellable };
      }

      return model.findAll(options);
    },

    /**
     * Finds an item state by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} itemState - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(itemState, values) {
      return itemState.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} itemState - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(itemState) {
      return itemState.destroy();
    },

    /**
     * Tells whether an item state is referenced by a cost or by a stock row.
     * Purchase items will join this check with HU-21; their restrictive
     * foreign key will also raise a `SequelizeForeignKeyConstraintError`, which
     * the delete handler already maps to 409 `Item state is in use`.
     * @param {number} itemStateId - Item state id.
     * @returns {Promise<boolean>} True when a cost or a stock references it.
     */
    async isReferenced(itemStateId) {
      const costModelToUse = costModel ?? require("../models/cost");
      const stockModelToUse = stockModel ?? require("../models/stock");
      const cost = await costModelToUse.findOne({
        where: { item_state_id: itemStateId },
      });

      if (cost !== null && cost !== undefined) {
        return true;
      }

      const stock = await stockModelToUse.findOne({
        where: { item_state_id: itemStateId },
      });

      return stock !== null && stock !== undefined;
    },
  };
}

const itemStateRepository = createItemStateRepository();

module.exports = {
  LIST_ORDER,
  createItemStateRepository,
  itemStateRepository,
};
