const { Op } = require("sequelize");
const PurchaseItem = require("../models/purchase-item");

const ITEM_ORDER = Object.freeze([["id", "ASC"]]);

/**
 * Creates a repository for the purchase lines. The model is injectable to
 * keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.itemModel] - PurchaseItem model.
 * @returns {object} Purchase item repository.
 */
function createPurchaseItemRepository({ itemModel = PurchaseItem } = {}) {
  return {
    /**
     * Inserts several purchase lines.
     * @param {object[]} values - Line attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object[]>} The created instances.
     */
    createMany(values, { transaction } = {}) {
      return itemModel.bulkCreate(values, { transaction, returning: true });
    },

    /**
     * Inserts one purchase line.
     * @param {object} values - Line attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The created instance.
     */
    create(values, { transaction } = {}) {
      return itemModel.create(values, { transaction });
    },

    /**
     * Lists the lines of a purchase ordered by id ascending.
     * @param {number} purchaseId - Purchase id.
     * @param {object} [options] - Query options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object[]>} The matching instances.
     */
    list(purchaseId, { transaction } = {}) {
      return itemModel.findAll({
        where: { purchase_id: purchaseId },
        order: ITEM_ORDER,
        transaction,
      });
    },

    /**
     * Finds one line that belongs to a purchase.
     * @param {number} purchaseId - Purchase id.
     * @param {number} itemId - Purchase item id.
     * @param {object} [options] - Query options.
     * @param {object} [options.transaction] - Open transaction.
     * @param {string} [options.lock] - Row lock mode.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(purchaseId, itemId, { transaction, lock } = {}) {
      return itemModel.findOne({
        where: { id: itemId, purchase_id: purchaseId },
        transaction,
        lock,
      });
    },

    /**
     * Finds a line by its unique product/item state combination, optionally
     * excluding one line so an update does not collide with itself.
     * @param {number} purchaseId - Purchase id.
     * @param {number} productId - Product id.
     * @param {number} itemStateId - Item state id.
     * @param {object} [options] - Query options.
     * @param {number} [options.excludeId] - Line id to ignore.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object|null>} The instance or null.
     */
    findByCombination(
      purchaseId,
      productId,
      itemStateId,
      { excludeId, transaction } = {},
    ) {
      const where = {
        purchase_id: purchaseId,
        product_id: productId,
        item_state_id: itemStateId,
      };

      if (excludeId !== undefined) {
        where.id = { [Op.ne]: excludeId };
      }

      return itemModel.findOne({ where, transaction });
    },

    /**
     * Persists changes on a purchase line.
     * @param {object} item - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(item, values, { transaction } = {}) {
      return item.update(values, { transaction });
    },

    /**
     * Deletes a purchase line.
     * @param {object} item - Loaded instance.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(item, { transaction } = {}) {
      return item.destroy({ transaction });
    },
  };
}

const purchaseItemRepository = createPurchaseItemRepository();

module.exports = {
  ITEM_ORDER,
  createPurchaseItemRepository,
  purchaseItemRepository,
};
