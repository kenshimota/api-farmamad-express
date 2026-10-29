const Tax = require("../models/tax");

const LIST_ORDER = Object.freeze([["code", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call of the taxes
 * module. The model is injectable to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Tax model.
 * @returns {object} Tax repository.
 */
function createTaxRepository({ model = Tax } = {}) {
  return {
    /**
     * Persists a new tax.
     * @param {object} values - Tax attributes.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object>} The created instance.
     */
    create(values, options) {
      return options === undefined
        ? model.create(values)
        : model.create(values, options);
    },

    /**
     * Lists taxes ordered by code, optionally filtered by active status.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.isActive] - Filter by `is_active` when set.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ isActive } = {}) {
      const query = { order: LIST_ORDER };

      if (isActive !== undefined) {
        query.where = { is_active: isActive };
      }

      return model.findAll(query);
    },

    /**
     * Finds a tax by primary key.
     * @param {number} id - Tax id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id, options) {
      return options === undefined
        ? model.findByPk(id)
        : model.findByPk(id, options);
    },

    /**
     * Persists changes on an existing tax.
     * @param {object} tax - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object>} The updated instance.
     */
    update(tax, values, options) {
      return options === undefined
        ? tax.update(values)
        : tax.update(values, options);
    },

    /**
     * Permanently removes a tax.
     * @param {object} tax - Loaded instance.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(tax, options) {
      return options === undefined ? tax.destroy() : tax.destroy(options);
    },
  };
}

const taxRepository = createTaxRepository();

module.exports = { LIST_ORDER, createTaxRepository, taxRepository };
