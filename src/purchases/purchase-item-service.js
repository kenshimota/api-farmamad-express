const {
  itemAlreadyExists,
  itemNotFound,
  notEditable,
  purchaseNotFound,
} = require("./errors");
const { calculateLineSubtotal, toDecimal } = require("./money");

/**
 * Creates the line operations of the purchases service.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Purchase repository.
 * @param {object} dependencies.itemRepository - Purchase item repository.
 * @param {object} dependencies.support - Shared service helpers.
 * @returns {object} The line operations.
 */
function createPurchaseItemOperations({ repository, itemRepository, support }) {
  return {
    /**
     * Lists the lines of a draft purchase.
     * @param {number} id - Purchase id.
     * @returns {Promise<object[]>} The lines ordered by id.
     */
    async listItems(id) {
      const purchase = await repository.findById(id);

      if (!purchase) {
        throw purchaseNotFound();
      }

      if (purchase.status !== "draft") {
        throw notEditable();
      }

      return itemRepository.list(id);
    },

    /**
     * Adds one line to a draft and recalculates the purchase.
     * @param {number} id - Purchase id.
     * @param {object} values - Validated line attributes.
     * @returns {Promise<object>} The purchase with its lines.
     */
    async addItem(id, values) {
      return repository.transaction(async (transaction) => {
        const purchase = await support.loadDraft(id, transaction);

        await support.assertItemReferences([values]);

        const existing = await itemRepository.findByCombination(
          id,
          values.product_id,
          values.item_state_id,
          { transaction },
        );

        if (existing) {
          throw itemAlreadyExists();
        }

        await itemRepository.create(
          {
            purchase_id: id,
            product_id: values.product_id,
            item_state_id: values.item_state_id,
            quantity: values.quantity,
            unit_cost: toDecimal(values.unit_cost),
            subtotal: toDecimal(
              calculateLineSubtotal(values.quantity, values.unit_cost),
            ),
          },
          { transaction },
        );

        await support.recalculate(purchase, transaction);

        return support.reload(id, transaction);
      });
    },

    /**
     * Updates one line of a draft and recalculates the purchase.
     * @param {number} purchaseId - Purchase id.
     * @param {number} itemId - Purchase item id.
     * @param {object} changes - Validated changes.
     * @returns {Promise<object>} The purchase with its lines.
     */
    async updateItem(purchaseId, itemId, changes) {
      return repository.transaction(async (transaction) => {
        const purchase = await support.loadDraft(purchaseId, transaction);
        const item = await itemRepository.findById(purchaseId, itemId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!item) {
          throw itemNotFound();
        }

        const productId = changes.product_id ?? item.product_id;
        const itemStateId = changes.item_state_id ?? item.item_state_id;
        const quantity = changes.quantity ?? item.quantity;
        const unitCost = changes.unit_cost ?? item.unit_cost;

        await support.assertItemReferences([
          { product_id: productId, item_state_id: itemStateId },
        ]);

        const duplicate = await itemRepository.findByCombination(
          purchaseId,
          productId,
          itemStateId,
          { excludeId: item.id, transaction },
        );

        if (duplicate) {
          throw itemAlreadyExists();
        }

        await itemRepository.update(
          item,
          {
            ...changes,
            product_id: productId,
            item_state_id: itemStateId,
            quantity,
            unit_cost: toDecimal(unitCost),
            subtotal: toDecimal(calculateLineSubtotal(quantity, unitCost)),
          },
          { transaction },
        );

        await support.recalculate(purchase, transaction);

        return support.reload(purchaseId, transaction);
      });
    },

    /**
     * Deletes one line of a draft and recalculates the purchase. Removing the
     * last line leaves every total at zero.
     * @param {number} purchaseId - Purchase id.
     * @param {number} itemId - Purchase item id.
     * @returns {Promise<void>} Resolves once it is deleted.
     */
    async deleteItem(purchaseId, itemId) {
      return repository.transaction(async (transaction) => {
        const purchase = await support.loadDraft(purchaseId, transaction);
        const item = await itemRepository.findById(purchaseId, itemId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!item) {
          throw itemNotFound();
        }

        await itemRepository.remove(item, { transaction });
        await support.recalculate(purchase, transaction);
      });
    },
  };
}

module.exports = { createPurchaseItemOperations };
