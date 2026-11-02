const { ACTOR_ATTRIBUTES } = require("./includes");

/**
 * Builds the persistence operations for the reference images and the append-only
 * status history. They live apart from the payment queries to keep every file
 * small and easy to test with model doubles.
 * @param {object} options - Injectable dependencies.
 * @param {object} options.model - Payment model.
 * @param {object} options.imageModel - Image model.
 * @param {object} options.historyModel - PaymentStatusHistory model.
 * @param {object} options.userModel - User model.
 * @returns {object} Image and history operations.
 */
function createAssetOperations({ model, imageModel, historyModel, userModel }) {
  return {
    /**
     * Persists one image row for a payment reference.
     * @param {object} values - Image attributes.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The created image.
     */
    createImage(values, options) {
      return imageModel.create(values, options);
    },

    /**
     * Loads one image row.
     * @param {number} id - Image id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The image or null.
     */
    findImage(id, options = {}) {
      return imageModel.findByPk(id, options);
    },

    /**
     * Deletes one image row.
     * @param {object} image - Loaded image.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    removeImage(image, options = {}) {
      return image.destroy(options);
    },

    /**
     * Counts the payments that still reference an image.
     * @param {number} imageId - Image id.
     * @returns {Promise<number>} The number of references.
     */
    countImageReferences(imageId) {
      return model.count({ where: { reference_image_id: imageId } });
    },

    /**
     * Appends one status history event.
     * @param {object} values - Event attributes.
     * @param {object} options - Sequelize options with the transaction.
     * @returns {Promise<object>} The created event.
     */
    createStatusHistory(values, options) {
      return historyModel.create(values, options);
    },

    /**
     * Lists the status history of a payment ordered by time and id.
     * @param {number} paymentId - Payment id.
     * @returns {Promise<object[]>} The events with their actor.
     */
    listStatusHistory(paymentId) {
      return historyModel.findAll({
        where: { payment_id: paymentId },
        order: [
          ["createdAt", "ASC"],
          ["id", "ASC"],
        ],
        include: [
          {
            model: userModel,
            as: "actor",
            attributes: [...ACTOR_ATTRIBUTES],
          },
        ],
      });
    },
  };
}

module.exports = { createAssetOperations };
