const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call for the
 * products module, including the existence checks of its foreign keys. The
 * models are injectable to keep the abstraction testable.
 * @param {object} [model] - Product model used for the queries.
 * @param {object} [categoryModel] - Category model used for the checks.
 * @param {object} [imageModel] - Image model used for the checks.
 * @returns {object} Product repository.
 */
function createProductRepository(
  model = Product,
  categoryModel = Category,
  imageModel = Image,
) {
  return {
    /**
     * Persists a new product.
     * @param {object} values - Validated product attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists every product ordered by id ascending.
     * @returns {Promise<object[]>} All product instances.
     */
    list() {
      return model.findAll({ order: LIST_ORDER });
    },

    /**
     * Finds a product by primary key.
     * @param {number} id - Positive integer id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Persists changes on an existing instance.
     * @param {object} product - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(product, values) {
      return product.update(values);
    },

    /**
     * Permanently removes an existing instance. A foreign key violation is
     * propagated to the router so it can answer 409.
     * @param {object} product - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(product) {
      return product.destroy();
    },

    /**
     * Tells whether a category exists without relying on raw SQL.
     * @param {number} id - Category id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async categoryExists(id) {
      const category = await categoryModel.findByPk(id);

      return category !== null && category !== undefined;
    },

    /**
     * Tells whether an image exists without relying on raw SQL.
     * @param {number} id - Image id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async imageExists(id) {
      const image = await imageModel.findByPk(id);

      return image !== null && image !== undefined;
    },
  };
}

const productRepository = createProductRepository();

module.exports = {
  LIST_ORDER,
  createProductRepository,
  productRepository,
};
