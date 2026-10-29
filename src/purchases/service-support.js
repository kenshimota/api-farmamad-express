const {
  ITEM_STATE_ID_MESSAGE,
  PRODUCT_ID_MESSAGE,
  SUPPLIER_ID_MESSAGE,
} = require("./validators");
const {
  httpError,
  itemAlreadyExists,
  notEditable,
  purchaseNotFound,
} = require("./errors");
const { calculateTotals, toTotalsAmounts } = require("./money");

/**
 * Builds the HTTP error used when an item reference no longer exists.
 * @param {string} field - `product_id` or `item_state_id`.
 * @param {string} key - Error key to expose.
 * @returns {Error} The 422 HTTP error.
 */
function invalidReference(field, key) {
  const message =
    field === "product_id" ? PRODUCT_ID_MESSAGE : ITEM_STATE_ID_MESSAGE;

  return httpError(422, { errors: { [key]: message } });
}

/**
 * Creates the helpers shared by every purchases operation. They keep the
 * validation, locking and recalculation rules in one place.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Purchase repository.
 * @param {object} dependencies.itemRepository - Purchase item repository.
 * @returns {object} The shared service helpers.
 */
function createServiceSupport({ repository, itemRepository }) {
  return {
    /**
     * Verifies that a supplier exists.
     * @param {number} supplierId - Supplier id.
     * @returns {Promise<void>} Resolves when it exists.
     * @throws {Error} 422 HTTP error when it does not.
     */
    async assertSupplier(supplierId) {
      if (!(await repository.supplierExists(supplierId))) {
        throw httpError(422, {
          errors: { supplier_id: SUPPLIER_ID_MESSAGE },
        });
      }
    },

    /**
     * Verifies that every product and item state of the lines exists.
     * @param {object[]} lines - Lines with product_id and item_state_id.
     * @param {string} [prefix] - Prefix for the error keys, e.g. `items`.
     * @returns {Promise<void>} Resolves when every reference exists.
     * @throws {Error} 422 HTTP error for the first missing reference.
     */
    async assertItemReferences(lines, prefix = "") {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const productKey = prefix
          ? `${prefix}.${index}.product_id`
          : "product_id";
        const stateKey = prefix
          ? `${prefix}.${index}.item_state_id`
          : "item_state_id";

        if (!(await repository.productExists(line.product_id))) {
          throw invalidReference("product_id", productKey);
        }

        if (!(await repository.itemStateExists(line.item_state_id))) {
          throw invalidReference("item_state_id", stateKey);
        }
      }
    },

    /**
     * Rejects duplicated product/item state pairs in the same request.
     * @param {object[]} lines - Requested lines.
     * @returns {void}
     * @throws {Error} 409 HTTP error when a pair repeats.
     */
    assertNoDuplicates(lines) {
      const seen = new Set();

      for (const line of lines) {
        const key = `${line.product_id}:${line.item_state_id}`;

        if (seen.has(key)) {
          throw itemAlreadyExists();
        }

        seen.add(key);
      }
    },

    /**
     * Loads and locks a draft purchase inside a transaction.
     * @param {number} id - Purchase id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The locked draft.
     * @throws {Error} 404 when missing and 409 when not editable.
     */
    async loadDraft(id, transaction) {
      const purchase = await repository.findByIdForUpdate(id, transaction);

      if (!purchase) {
        throw purchaseNotFound();
      }

      if (purchase.status !== "draft") {
        throw notEditable();
      }

      return purchase;
    },

    /**
     * Recalculates the purchase totals from its current lines.
     * @param {object} purchase - Loaded purchase.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The calculated totals.
     */
    async recalculate(purchase, transaction) {
      const lines = await itemRepository.list(purchase.id, { transaction });
      const totals = calculateTotals(lines);

      await repository.update(purchase, toTotalsAmounts(totals), {
        transaction,
      });

      return totals;
    },

    /**
     * Reloads a purchase with its lines for a response.
     * @param {number} id - Purchase id.
     * @param {object} transaction - Open transaction.
     * @param {object} [options] - Reload options.
     * @param {boolean} [options.includeSupplier] - Nest the supplier.
     * @returns {Promise<object|null>} The reloaded purchase.
     */
    reload(id, transaction, { includeSupplier = false } = {}) {
      return repository.findById(id, {
        includeItems: true,
        includeSupplier,
        transaction,
      });
    },
  };
}

module.exports = { createServiceSupport, invalidReference };
