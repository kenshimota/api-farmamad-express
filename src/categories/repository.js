const Category = require("../models/category");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call for the
 * categories module, so routers and middlewares no longer depend on Sequelize
 * directly. The model is injectable to keep the abstraction testable.
 * @param {object} [model] - Sequelize model used for the queries.
 * @returns {object} Category repository.
 */
function createCategoryRepository(model = Category) {
  return {
    /**
     * Persists a new category.
     * @param {object} values - Validated category attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists every category ordered by id ascending.
     * @returns {Promise<object[]>} All category instances.
     */
    list() {
      return model.findAll({ order: LIST_ORDER });
    },

    /**
     * Finds a category by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} category - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(category, values) {
      return category.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} category - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(category) {
      return category.destroy();
    },
  };
}

const categoryRepository = createCategoryRepository();

module.exports = {
  LIST_ORDER,
  createCategoryRepository,
  categoryRepository,
};
