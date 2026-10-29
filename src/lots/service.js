const { lotRepository } = require("./repository");
const {
  invalidReference,
  lotAlreadyExists,
  lotHasStock,
  reservedExceedsStock,
  sectionShelfMismatch,
  shelfWarehouseMismatch,
} = require("./errors");

/**
 * Ensures the cross-field rule `reserved <= stock` even when the service is
 * called without the HTTP validator.
 * @param {{ stock: number, reserved: number }} values - Lot quantities.
 * @throws {Error} 422 when reserved is greater than stock.
 */
function assertQuantities(values) {
  if (Number(values.reserved) > Number(values.stock)) {
    throw reservedExceedsStock();
  }
}

/**
 * Creates the lots service. Every business rule lives here so routers only
 * parse, authorize and serialize. Dependencies are injectable for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Lot repository.
 * @returns {object} The lots service.
 */
function createLotService({ repository = lotRepository } = {}) {
  /**
   * Loads every referenced row inside the transaction and validates both the
   * existence of the references and the physical location coherence.
   * @param {object} values - Validated lot attributes.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>} Resolves when every reference is valid.
   */
  async function validateReferences(values, transaction) {
    const options = { transaction };
    const [product, itemState, warehouse, shelf, section] = await Promise.all([
      repository.productExists(values.product_id, options),
      repository.itemStateExists(values.item_state_id, options),
      repository.warehouseExists(values.warehouse_id, options),
      repository.findShelf(values.shelf_id, options),
      repository.findSection(values.section_id, options),
    ]);

    const missing = [
      ["product_id", product],
      ["item_state_id", itemState],
      ["warehouse_id", warehouse],
      ["shelf_id", shelf],
      ["section_id", section],
    ].find(([, record]) => !record);

    if (missing) {
      throw invalidReference(missing[0]);
    }

    const locationRules = [
      [shelf.warehouse_id, values.warehouse_id, shelfWarehouseMismatch],
      [section.shelf_id, values.shelf_id, sectionShelfMismatch],
    ];

    for (const [actual, expected, errorFactory] of locationRules) {
      if (Number(actual) !== Number(expected)) {
        throw errorFactory();
      }
    }
  }

  /**
   * Rejects a duplicated `(product_id, number)` inside the transaction.
   * @param {object} values - Validated lot attributes.
   * @param {object} transaction - Open transaction.
   * @param {number} [excludeId] - Lot being updated.
   * @returns {Promise<void>} Resolves when the pair is free.
   */
  async function ensureUnique(values, transaction, excludeId) {
    const duplicate = await repository.findDuplicate(
      {
        productId: values.product_id,
        number: values.number,
        excludeId,
      },
      { transaction },
    );

    if (duplicate) {
      throw lotAlreadyExists();
    }
  }

  /**
   * Template for every write: validate the payload and the references, keep
   * the pair unique and persist inside one transaction. The concrete write
   * step is injected so create and update share the invariant sequence.
   * @param {object} values - Validated lot attributes.
   * @param {object} operation - Write strategy.
   * @param {number} [operation.excludeId] - Lot excluded from uniqueness.
   * @param {(transaction: object) => Promise<number>} operation.write - Write
   *   step that persists the row and returns its id.
   * @returns {Promise<object>} The persisted lot with its relations.
   */
  async function writeAtomically(values, { excludeId, write }) {
    assertQuantities(values);

    return repository.transaction(async (transaction) => {
      await validateReferences(values, transaction);
      await ensureUnique(values, transaction, excludeId);
      const id = await write(transaction);

      return repository.findById(id, { transaction });
    });
  }

  return {
    /**
     * Lists lots with the documented filters and order.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching lots.
     */
    listLots(filters) {
      return repository.list(filters);
    },

    /**
     * Loads one lot with its relations.
     * @param {number} id - Lot id.
     * @returns {Promise<object|null>} The lot or null.
     */
    getLot(id) {
      return repository.findById(id);
    },

    /**
     * Creates a lot after validating references, location coherence and the
     * unique `(product_id, number)` pair inside one transaction.
     * @param {object} values - Validated lot attributes.
     * @returns {Promise<object>} The created lot with its relations.
     * @throws {Error} 422 for invalid references/location/quantities.
     * @throws {Error} 409 when the pair already exists.
     */
    async createLot(values) {
      return writeAtomically(values, {
        write: async (transaction) => {
          const created = await repository.create(values, { transaction });

          return created.id;
        },
      });
    },

    /**
     * Replaces the editable fields of a lot, revalidating references, location
     * coherence and uniqueness inside one transaction.
     * @param {object} lot - Loaded lot.
     * @param {object} values - Validated lot attributes.
     * @returns {Promise<object>} The updated lot with its relations.
     * @throws {Error} 422 for invalid references/location/quantities.
     * @throws {Error} 409 when the pair belongs to another lot.
     */
    async updateLot(lot, values) {
      return writeAtomically(values, {
        excludeId: lot.id,
        write: async (transaction) => {
          await repository.update(lot, values, { transaction });

          return lot.id;
        },
      });
    },

    /**
     * Deletes a lot only when both quantities are zero.
     * @param {object} lot - Loaded lot.
     * @returns {Promise<void>} Resolves once the row is deleted.
     * @throws {Error} 409 when the lot still has stock or reservations.
     */
    async deleteLot(lot) {
      if (Number(lot.stock) > 0 || Number(lot.reserved) > 0) {
        throw lotHasStock();
      }

      return repository.remove(lot);
    },
  };
}

const lotService = createLotService();

module.exports = { createLotService, lotService };
