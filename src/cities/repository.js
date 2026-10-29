const City = require("../models/city");
const State = require("../models/state");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);
const STATE_INCLUDE = Object.freeze([{ model: State, as: "state" }]);

/**
 * Creates a repository that encapsulates every persistence call for the
 * cities module, including the existence check of its state foreign key. The
 * models are injectable to keep the abstraction testable.
 * @param {object} [model] - City model used for the queries.
 * @param {object} [stateModel] - State model used for the checks.
 * @returns {object} City repository.
 */
function createCityRepository(model = City, stateModel = State) {
  return {
    /**
     * Persists a new city.
     * @param {object} values - Validated city attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists cities ordered by id ascending, optionally filtered by an exact
     * state_id and optionally including the nested state.
     * @param {object} [options] - Query options.
     * @param {number} [options.stateId] - Exact state id filter.
     * @param {boolean} [options.includeState] - Include the nested state.
     * @returns {Promise<object[]>} The matching city instances.
     */
    list({ stateId, includeState } = {}) {
      const options = { order: LIST_ORDER };

      if (stateId !== undefined) {
        options.where = { state_id: stateId };
      }

      if (includeState) {
        options.include = STATE_INCLUDE;
      }

      return model.findAll(options);
    },

    /**
     * Finds a city by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} city - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(city, values) {
      return city.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} city - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(city) {
      return city.destroy();
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
  };
}

const cityRepository = createCityRepository();

module.exports = {
  LIST_ORDER,
  STATE_INCLUDE,
  createCityRepository,
  cityRepository,
};
