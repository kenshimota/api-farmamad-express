const State = require("../models/state");

const LIST_ORDER = Object.freeze([["name", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call for the
 * states module. The model is injectable to keep the abstraction testable.
 * @param {object} [model] - Sequelize model used for the queries.
 * @returns {object} State repository.
 */
function createStateRepository(model = State) {
  return {
    /**
     * Persists a new state.
     * @param {object} values - Validated state attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists every state ordered by name ascending.
     * @returns {Promise<object[]>} All state instances.
     */
    list() {
      return model.findAll({ order: LIST_ORDER });
    },

    /**
     * Finds a state by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} state - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(state, values) {
      return state.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} state - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(state) {
      return state.destroy();
    },
  };
}

const stateRepository = createStateRepository();

module.exports = {
  LIST_ORDER,
  createStateRepository,
  stateRepository,
};
