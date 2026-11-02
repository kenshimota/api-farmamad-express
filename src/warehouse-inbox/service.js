const { inboxRepository } = require("./repository");
const {
  alreadyLocated,
  beingLocatedByAnotherUser,
  invalidReference,
  lotNotFound,
  sectionShelfMismatch,
  shelfWarehouseMismatch,
} = require("./errors");

/**
 * Creates the warehouse inbox service. The repository and clock are injectable
 * so every rule can be unit tested without a database.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Inbox repository.
 * @param {function(): Date} [dependencies.clock] - Clock for the audit fields.
 * @returns {object} The inbox service.
 */
function createInboxService({
  repository = inboxRepository,
  clock = () => new Date(),
} = {}) {
  /**
   * Loads and locks a lot, translating a missing row into 404.
   * @param {number} id - Lot id.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object>} The locked lot.
   */
  async function lockLot(id, transaction) {
    const lot = await repository.findForUpdate(id, transaction);

    if (!lot) {
      throw lotNotFound();
    }

    return lot;
  }

  /**
   * Rejects a lot that already completed the location lifecycle.
   * @param {object} lot - Locked lot.
   * @returns {void}
   */
  function assertNotLocated(lot) {
    if (lot.location_status === "located") {
      throw alreadyLocated();
    }
  }

  /**
   * Rejects a lot claimed by a different user.
   * @param {object} lot - Locked lot.
   * @param {number} userId - Authenticated user id.
   * @returns {void}
   */
  function assertOwnership(lot, userId) {
    if (
      lot.location_status === "in_progress" &&
      Number(lot.location_started_by) !== Number(userId)
    ) {
      throw beingLocatedByAnotherUser();
    }
  }

  /**
   * Validates the warehouse/shelf/section chain inside the transaction.
   * @param {object} values - Location ids.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<void>} Resolves when the location is coherent.
   */
  async function validateLocation(values, transaction) {
    const options = { transaction };
    const [warehouse, shelf, section] = await Promise.all([
      repository.findWarehouse(values.warehouse_id, options),
      repository.findShelf(values.shelf_id, options),
      repository.findSection(values.section_id, options),
    ]);

    if (!warehouse) {
      throw invalidReference("warehouse_id");
    }

    if (!shelf) {
      throw invalidReference("shelf_id");
    }

    if (!section) {
      throw invalidReference("section_id");
    }

    if (Number(shelf.warehouse_id) !== Number(warehouse.id)) {
      throw shelfWarehouseMismatch();
    }

    if (Number(section.shelf_id) !== Number(shelf.id)) {
      throw sectionShelfMismatch();
    }
  }

  return {
    /**
     * Lists the lots of the inbox.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching lots.
     */
    listLots(filters) {
      return repository.list(filters);
    },

    /**
     * Starts locating a lot. The transition is idempotent for the same user and
     * rejects another user already working on it.
     * @param {number} id - Lot id.
     * @param {number} userId - Authenticated user id.
     * @returns {Promise<object>} The updated lot.
     * @throws {Error} 404 when it does not exist, 409 when not available.
     */
    async startLot(id, userId) {
      return repository.transaction(async (transaction) => {
        const lot = await lockLot(id, transaction);

        assertNotLocated(lot);

        if (lot.location_status === "in_progress") {
          assertOwnership(lot, userId);

          return repository.findById(id, { transaction });
        }

        await repository.update(
          lot,
          {
            location_status: "in_progress",
            location_started_at: clock(),
            location_started_by: userId,
          },
          transaction,
        );

        return repository.findById(id, { transaction });
      });
    },

    /**
     * Assigns the physical location and marks the lot as located.
     * @param {number} id - Lot id.
     * @param {object} values - Validated warehouse, shelf and section ids.
     * @param {number} userId - Authenticated user id.
     * @returns {Promise<object>} The updated lot.
     * @throws {Error} 404/409/422 according to the contract.
     */
    async assignLocation(id, values, userId) {
      return repository.transaction(async (transaction) => {
        const lot = await lockLot(id, transaction);

        assertNotLocated(lot);
        assertOwnership(lot, userId);
        await validateLocation(values, transaction);

        await repository.update(
          lot,
          {
            warehouse_id: values.warehouse_id,
            shelf_id: values.shelf_id,
            section_id: values.section_id,
            location_status: "located",
            located_at: clock(),
            located_by: userId,
          },
          transaction,
        );

        return repository.findById(id, { transaction });
      });
    },
  };
}

const inboxService = createInboxService();

module.exports = { createInboxService, inboxService };
