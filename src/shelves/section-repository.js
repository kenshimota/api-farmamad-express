const ShelfSection = require("../models/shelf-section");

const LIST_ORDER = Object.freeze([["code", "ASC"]]);

/**
 * Creates a repository that encapsulates every persistence call of the section
 * side of the module. The model is injectable to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - ShelfSection model.
 * @returns {object} Section repository.
 */
function createSectionRepository({ model = ShelfSection } = {}) {
  return {
    /**
     * Persists a new section.
     * @param {object} values - Validated section attributes plus shelf_id.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists the sections of a shelf ordered by code.
     * @param {number} shelfId - Shelf id.
     * @returns {Promise<object[]>} The matching sections.
     */
    listByShelf(shelfId) {
      return model.findAll({
        where: { shelf_id: shelfId },
        order: LIST_ORDER,
      });
    },

    /**
     * Finds a section only when it belongs to the requested shelf, so a
     * section from another shelf is reported as missing.
     * @param {number} shelfId - Shelf id from the route.
     * @param {number} id - Section id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findByShelfAndId(shelfId, id) {
      return model.findOne({ where: { id, shelf_id: shelfId } });
    },

    /**
     * Lists the section ids of a shelf.
     * @param {number} shelfId - Shelf id.
     * @returns {Promise<number[]>} The section ids.
     */
    async listIdsByShelf(shelfId) {
      const sections = await model.findAll({
        where: { shelf_id: shelfId },
        attributes: ["id"],
      });

      return sections.map((section) => section.id);
    },

    /**
     * Persists changes on an existing section.
     * @param {object} section - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(section, values) {
      return section.update(values);
    },

    /**
     * Permanently removes a section.
     * @param {object} section - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(section) {
      return section.destroy();
    },
  };
}

const sectionRepository = createSectionRepository();

module.exports = {
  LIST_ORDER,
  createSectionRepository,
  sectionRepository,
};
