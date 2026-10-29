const { sectionRepository } = require("./section-repository");
const { sectionHasLots } = require("./errors");
const { countSectionLots } = require("./lots");

/**
 * Creates the sections service. Every business rule lives here so the routers
 * only parse, authorize and serialize. Dependencies are injectable for unit
 * tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Section repository.
 * @param {object} [dependencies.lots] - Lots helper.
 * @returns {object} The sections service.
 */
function createSectionService({
  repository = sectionRepository,
  lots = { countSectionLots },
} = {}) {
  return {
    /**
     * Lists the sections of a shelf ordered by code.
     * @param {number} shelfId - Shelf id.
     * @returns {Promise<object[]>} The sections.
     */
    listSections(shelfId) {
      return repository.listByShelf(shelfId);
    },

    /**
     * Loads a section only when it belongs to the shelf from the route.
     * @param {number} shelfId - Shelf id.
     * @param {number} sectionId - Section id.
     * @returns {Promise<object|null>} The section or null.
     */
    getSection(shelfId, sectionId) {
      return repository.findByShelfAndId(shelfId, sectionId);
    },

    /**
     * Creates a section inside the loaded shelf.
     * @param {object} shelf - Parent shelf.
     * @param {object} values - Validated section attributes.
     * @returns {Promise<object>} The created section.
     */
    createSection(shelf, values) {
      return repository.create({ shelf_id: shelf.id, ...values });
    },

    /**
     * Updates the editable fields of a section.
     * @param {object} section - Loaded section.
     * @param {object} values - Validated editable attributes.
     * @returns {Promise<object>} The updated section.
     */
    updateSection(section, values) {
      return repository.update(section, values);
    },

    /**
     * Deletes a section when no lot references it.
     * @param {object} section - Loaded section.
     * @returns {Promise<void>} Resolves once the section is deleted.
     * @throws {Error} 409 when lots still reference the section.
     */
    async deleteSection(section) {
      if ((await lots.countSectionLots(section.id)) > 0) {
        throw sectionHasLots();
      }

      return repository.remove(section);
    },
  };
}

const sectionService = createSectionService();

module.exports = { createSectionService, sectionService };
