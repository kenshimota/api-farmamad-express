const {
  httpError,
  itemAlreadyExists,
  itemNotFound,
  notEditable,
  purchaseNotFound,
} = require("./errors");
const { toLineAmounts } = require("./money");

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

        const existing = await support.findDuplicateLine({
          purchaseId: id,
          productId: values.product_id,
          itemStateId: values.item_state_id,
          lotNumber: values.lot_number,
          transaction,
        });

        if (existing) {
          throw itemAlreadyExists();
        }

        await itemRepository.create(
          {
            purchase_id: id,
            product_id: values.product_id,
            item_state_id: values.item_state_id,
            quantity: values.quantity,
            lot_number: values.lot_number ?? null,
            expiration_date: values.expiration_date ?? null,
            ...toLineAmounts(values),
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
        const taxAmount = changes.tax_amount ?? item.tax_amount ?? 0;
        const lotNumber = changes.lot_number ?? item.lot_number ?? null;
        const expirationDate =
          changes.expiration_date ?? item.expiration_date ?? null;

        if (lotNumber === null || expirationDate === null) {
          throw httpError(400, {
            message: "lot_number and expiration_date are required",
          });
        }

        await support.assertItemReferences([
          { product_id: productId, item_state_id: itemStateId },
        ]);

        const duplicate = await support.findDuplicateLine({
          purchaseId,
          productId,
          itemStateId,
          lotNumber,
          excludeId: item.id,
          transaction,
        });

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
            lot_number: lotNumber,
            expiration_date: expirationDate,
            ...toLineAmounts({
              quantity,
              unit_cost: unitCost,
              tax_amount: taxAmount,
            }),
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
