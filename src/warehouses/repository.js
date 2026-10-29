const Warehouse = require("../models/warehouse");
const { warehouseSearch } = require("./search");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);

/**
 * Builds the Sequelize options for the warehouse listing. The search term is
 * normalized first so blank or malformed values fall back to the full list.
 * @param {unknown} search - Raw `req.query.search` value.
 * @returns {object} Options accepted by `Warehouse.findAll`.
 */
function buildListOptions(search) {
  const term = warehouseSearch.normalize(search);
  const options = { order: LIST_ORDER };

  if (term) {
    options.where = warehouseSearch.buildFilter(term);
  }

  return options;
}

/**
 * Creates a repository that encapsulates every persistence call for the
 * warehouses module, so routers and middlewares no longer depend on Sequelize
 * directly. The model is injectable to keep the abstraction testable.
 * @param {object} [model] - Sequelize model used for the queries.
 * @returns {object} Warehouse repository.
 */
function createWarehouseRepository(model = Warehouse) {
  return {
    /**
     * Persists a new warehouse.
     * @param {object} values - Validated warehouse attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists warehouses ordered by id, optionally filtered by the search term.
     * @param {unknown} search - Raw search term.
     * @returns {Promise<object[]>} Matching instances.
     */
    list(search) {
      return model.findAll(buildListOptions(search));
    },

    /**
     * Finds a warehouse by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} warehouse - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(warehouse, values) {
      return warehouse.update(values);
    },

    /**
     * Permanently removes an existing instance.
     * @param {object} warehouse - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(warehouse) {
      return warehouse.destroy();
    },
  };
}

const warehouseRepository = createWarehouseRepository();

module.exports = {
  LIST_ORDER,
  buildListOptions,
  createWarehouseRepository,
  warehouseRepository,
};
