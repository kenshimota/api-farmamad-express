const { shelfRepository } = require("./shelf-repository");
const { invalidWarehouseId, shelfHasLots } = require("./errors");
const { countShelfLots } = require("./lots");

/**
 * Creates the shelves service. Every business rule lives here so the routers
 * only parse, authorize and serialize. Dependencies are injectable for unit
 * tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Shelf repository.
 * @param {object} [dependencies.lots] - Lots helper.
 * @returns {object} The shelves service.
 */
function createShelfService({
  repository = shelfRepository,
  lots = { countShelfLots },
} = {}) {
  return {
    /**
     * Lists shelves ordered by warehouse and code.
     * @param {object} [options] - Listing options.
     * @param {number} [options.warehouseId] - Exact warehouse filter.
     * @param {boolean} [options.includeSections] - Include sections.
     * @returns {Promise<object[]>} The matching shelves.
     */
    listShelves(options) {
      return repository.list(options);
    },

    /**
     * Loads a shelf with its sections.
     * @param {number} id - Shelf id.
     * @returns {Promise<object|null>} The shelf or null.
     */
    getShelf(id) {
      return repository.findByIdWithSections(id);
    },

    /**
     * Loads a shelf without its sections, used by the nested section routes.
     * @param {number} id - Shelf id.
     * @returns {Promise<object|null>} The shelf or null.
     */
    getShelfWithoutSections(id) {
      return repository.findById(id);
    },

    /**
     * Creates a shelf after checking that its warehouse exists.
     * @param {object} values - Validated shelf attributes.
     * @returns {Promise<object>} The created shelf.
     * @throws {Error} 422 when the warehouse does not exist.
     */
    async createShelf(values) {
      if (!(await repository.warehouseExists(values.warehouse_id))) {
        throw invalidWarehouseId();
      }

      return repository.create(values);
    },

    /**
     * Updates the editable fields of a shelf.
     * @param {object} shelf - Loaded shelf.
     * @param {object} values - Validated editable attributes.
     * @returns {Promise<object>} The updated shelf.
     */
    updateShelf(shelf, values) {
      return repository.update(shelf, values);
    },

    /**
     * Deletes a shelf when no lot references it or any of its sections. The
     * database removes the sections in cascade.
     * @param {object} shelf - Loaded shelf with its sections.
     * @returns {Promise<void>} Resolves once the shelf is deleted.
     * @throws {Error} 409 when lots still reference the shelf or a section.
     */
    async deleteShelf(shelf) {
      const sectionIds = Array.isArray(shelf.sections)
        ? shelf.sections.map((section) => section.id)
        : await repository.sectionIds(shelf.id);

      if ((await lots.countShelfLots(shelf.id, sectionIds)) > 0) {
        throw shelfHasLots();
      }

      return repository.remove(shelf);
    },
  };
}

const shelfService = createShelfService();

module.exports = { createShelfService, shelfService };
