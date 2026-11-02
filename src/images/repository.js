const Image = require("../models/image");
const { findPage } = require("../shared/pagination");
const { buildTextSearch } = require("../shared/list-query");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);
const SORT_FIELDS = Object.freeze(["id", "reference"]);

/**
 * Builds the Sequelize options of the image listing.
 * @param {object} [filters] - Listing filters.
 * @param {string} [filters.q] - Partial text search.
 * @param {Array<[string, string]>} [order] - Order clauses.
 * @returns {object} Options accepted by `Image.findAll`.
 */
function buildListOptions({ q } = {}, order = LIST_ORDER) {
  const options = { order };
  const search = buildTextSearch(q, ["reference", "url", "pathname"]);

  if (search) {
    options.where = search;
  }

  return options;
}

/**
 * Creates a repository that encapsulates every persistence call for the
 * images module, so routers and middlewares do not depend on Sequelize
 * directly. The model is injectable to keep the abstraction testable.
 * @param {object} [model] - Sequelize model used for the queries.
 * @returns {object} Image repository.
 */
function createImageRepository(model = Image) {
  return {
    /**
     * Persists a new image.
     * @param {object} values - Validated image attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists every image ordered by id ascending.
     * @returns {Promise<object[]>} All image instances.
     */
    list(filters, { pagination, order = LIST_ORDER } = {}) {
      return findPage(model, buildListOptions(filters, order), pagination);
    },

    /**
     * Finds an image by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} image - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(image, values) {
      return image.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} image - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(image) {
      return image.destroy();
    },
  };
}

const imageRepository = createImageRepository();

module.exports = {
  LIST_ORDER,
  SORT_FIELDS,
  buildListOptions,
  createImageRepository,
  imageRepository,
};
