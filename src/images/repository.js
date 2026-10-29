const Image = require("../models/image");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);

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
    list() {
      return model.findAll({ order: LIST_ORDER });
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
  createImageRepository,
  imageRepository,
};
