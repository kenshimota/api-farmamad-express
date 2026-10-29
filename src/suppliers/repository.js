const Supplier = require("../models/supplier");
const City = require("../models/city");
const State = require("../models/state");
const { supplierSearch } = require("./search");

const LIST_ORDER = Object.freeze([["name", "ASC"]]);
const LOCATION_INCLUDE = Object.freeze([
  { model: City, as: "city" },
  { model: State, as: "state" },
]);

/**
 * Builds the Sequelize options for the supplier listing, combining the
 * optional exact foreign key filters with the optional partial search.
 * @param {object} [filters] - Listing filters.
 * @param {number} [filters.stateId] - Exact state id.
 * @param {number} [filters.cityId] - Exact city id.
 * @param {unknown} [filters.q] - Raw search term.
 * @returns {object} Options accepted by `Supplier.findAll`.
 */
function buildListOptions({ stateId, cityId, q } = {}) {
  const options = { order: LIST_ORDER, include: LOCATION_INCLUDE };
  const where = {};

  if (stateId !== undefined) {
    where.state_id = stateId;
  }

  if (cityId !== undefined) {
    where.city_id = cityId;
  }

  const term = supplierSearch.normalize(q);

  if (term) {
    Object.assign(where, supplierSearch.buildFilter(term));
  }

  if (Object.keys(where).length || term) {
    options.where = where;
  }

  return options;
}

/**
 * Creates a repository that encapsulates every persistence call for the
 * suppliers module, including the existence checks of its foreign keys. The
 * models are injectable to keep the abstraction testable.
 * @param {object} [model] - Supplier model used for the queries.
 * @param {object} [cityModel] - City model used for the location checks.
 * @param {object} [stateModel] - State model used for the location checks.
 * @returns {object} Supplier repository.
 */
function createSupplierRepository(
  model = Supplier,
  cityModel = City,
  stateModel = State,
) {
  return {
    /**
     * Persists a new supplier.
     * @param {object} values - Validated supplier attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists suppliers ordered by name, optionally filtered by state, city and
     * a partial term over name and identification. The city and state are
     * always included.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching instances.
     */
    list(filters) {
      return model.findAll(buildListOptions(filters));
    },

    /**
     * Finds a supplier by primary key.
     * @param {number} id - Positive integer id.
     * @param {object} [options] - Query options.
     * @param {boolean} [options.includeLocation] - Include city and state.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id, { includeLocation = false } = {}) {
      if (!includeLocation) {
        return model.findByPk(id);
      }

      return model.findByPk(id, { include: LOCATION_INCLUDE });
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} supplier - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(supplier, values) {
      return supplier.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} supplier - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(supplier) {
      return supplier.destroy();
    },

    /**
     * Loads a city by primary key without raw SQL.
     * @param {number} id - City id.
     * @returns {Promise<object|null>} The city or null.
     */
    findCity(id) {
      return cityModel.findByPk(id);
    },

    /**
     * Tells whether a state exists without relying on raw SQL.
     * @param {number} id - State id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async stateExists(id) {
      const state = await stateModel.findByPk(id);

      return state !== null && state !== undefined;
    },

    /**
     * Tells whether the supplier has purchases. The `purchases` table belongs
     * to HU-21 and does not exist yet, so this always resolves to false. When
     * that table is created, this method must query `purchases.supplier_id`;
     * the restrictive foreign key will also raise a
     * `SequelizeForeignKeyConstraintError`, which `handleDeleteError` already
     * maps to 409 `Supplier is in use`.
     * @param {number} supplierId - Supplier id.
     * @returns {Promise<boolean>} False until purchases exist.
     */
    async hasPurchases(supplierId) {
      void supplierId;

      return false;
    },
  };
}

const supplierRepository = createSupplierRepository();

module.exports = {
  LIST_ORDER,
  LOCATION_INCLUDE,
  buildListOptions,
  createSupplierRepository,
  supplierRepository,
};
