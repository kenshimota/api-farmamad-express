const sequelize = require("../database");
const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");
const Tax = require("../models/tax");

const LIST_ORDER = Object.freeze([["id", "ASC"]]);

/**
 * Tells whether a row with the given id exists in a model, without relying on
 * raw SQL. It backs every foreign key existence check of the repository.
 * @param {object} model - Sequelize model.
 * @param {number} id - Primary key to look up.
 * @returns {Promise<boolean>} True when the row exists.
 */
async function exists(model, id) {
  const row = await model.findByPk(id);

  return row !== null && row !== undefined;
}

/**
 * Creates a repository that encapsulates every persistence call for the
 * products module, including the existence checks of its foreign keys. The
 * models are injectable to keep the abstraction testable.
 * @param {object} [model] - Product model used for the queries.
 * @param {object} [categoryModel] - Category model used for the checks.
 * @param {object} [imageModel] - Image model used for the checks.
 * @param {Function} [transactionRunner] - Runs a callback in one transaction.
 * @param {object} [taxModel] - Tax model used for the checks.
 * @returns {object} Product repository.
 */
function createProductRepository(
  model = Product,
  categoryModel = Category,
  imageModel = Image,
  transactionRunner = (work) => sequelize.transaction(work),
  taxModel = Tax,
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
     * Creates the image row and the product in one transaction, so a failed
     * product insert also rolls back the image.
     * @param {object} imageValues - Image attributes to persist.
     * @param {object} values - Validated product attributes.
     * @returns {Promise<object>} The created product instance.
     */
    createWithImage(imageValues, values) {
      return transactionRunner(async (transaction) => {
        const image = await imageModel.create(imageValues, { transaction });

        return model.create({ ...values, image_id: image.id }, { transaction });
      });
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
     * Creates a new image row and replaces `image_id` in one transaction. The
     * previous image and its files are left untouched because they may be
     * shared by other products.
     * @param {object} product - Loaded product instance.
     * @param {object} imageValues - Image attributes to persist.
     * @param {object} values - Validated product attributes.
     * @returns {Promise<object>} The updated product instance.
     */
    updateWithImage(product, imageValues, values) {
      return transactionRunner(async (transaction) => {
        const image = await imageModel.create(imageValues, { transaction });

        return product.update(
          { ...values, image_id: image.id },
          { transaction },
        );
      });
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
    categoryExists(id) {
      return exists(categoryModel, id);
    },

    /**
     * Tells whether an image exists without relying on raw SQL.
     * @param {number} id - Image id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    imageExists(id) {
      return exists(imageModel, id);
    },

    /**
     * Tells whether a tax exists without relying on raw SQL.
     * @param {number} id - Tax id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    taxExists(id) {
      return exists(taxModel, id);
    },
  };
}

const productRepository = createProductRepository();

module.exports = {
  LIST_ORDER,
  createProductRepository,
  productRepository,
};
