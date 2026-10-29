const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const Warehouse = require("../models/warehouse");

const LIST_ORDER = Object.freeze([
  ["warehouse_id", "ASC"],
  ["code", "ASC"],
]);
const SECTIONS_INCLUDE = Object.freeze([
  {
    model: ShelfSection,
    as: "sections",
    separate: true,
    order: [["code", "ASC"]],
  },
]);

/**
 * Creates a repository that encapsulates every persistence call of the shelf
 * side of the module. Models are injectable to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Shelf model.
 * @param {object} [options.sectionModel] - ShelfSection model.
 * @param {object} [options.warehouseModel] - Warehouse model.
 * @returns {object} Shelf repository.
 */
function createShelfRepository({
  model = Shelf,
  sectionModel = ShelfSection,
  warehouseModel = Warehouse,
} = {}) {
  return {
    /**
     * Persists a new shelf.
     * @param {object} values - Validated shelf attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists shelves ordered by warehouse and code, optionally filtered by
     * warehouse and optionally including the nested sections.
     * @param {object} [options] - Query options.
     * @param {number} [options.warehouseId] - Exact warehouse filter.
     * @param {boolean} [options.includeSections] - Include the sections.
     * @returns {Promise<object[]>} The matching shelves.
     */
    list({ warehouseId, includeSections } = {}) {
      const query = { order: LIST_ORDER };

      if (warehouseId !== undefined) {
        query.where = { warehouse_id: warehouseId };
      }

      if (includeSections) {
        query.include = SECTIONS_INCLUDE;
      }

      return model.findAll(query);
    },

    /**
     * Finds a shelf by primary key without its sections.
     * @param {number} id - Shelf id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id) {
      return model.findByPk(id);
    },

    /**
     * Finds a shelf by primary key including its sections.
     * @param {number} id - Shelf id.
     * @returns {Promise<object|null>} The instance or null.
     */
    findByIdWithSections(id) {
      return model.findByPk(id, { include: SECTIONS_INCLUDE });
    },

    /**
     * Persists changes on an existing shelf.
     * @param {object} shelf - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @returns {Promise<object>} The updated instance.
     */
    update(shelf, values) {
      return shelf.update(values);
    },

    /**
     * Permanently removes a shelf. The database cascades its sections.
     * @param {object} shelf - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(shelf) {
      return shelf.destroy();
    },

    /**
     * Tells whether a warehouse exists without relying on raw SQL.
     * @param {number} id - Warehouse id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async warehouseExists(id) {
      const warehouse = await warehouseModel.findByPk(id);

      return warehouse !== null && warehouse !== undefined;
    },

    /**
     * Lists the section ids of a shelf, used by the defensive lots check.
     * @param {number} shelfId - Shelf id.
     * @returns {Promise<number[]>} The section ids.
     */
    async sectionIds(shelfId) {
      const sections = await sectionModel.findAll({
        where: { shelf_id: shelfId },
        attributes: ["id"],
      });

      return sections.map((section) => section.id);
    },
  };
}

const shelfRepository = createShelfRepository();

module.exports = {
  LIST_ORDER,
  SECTIONS_INCLUDE,
  createShelfRepository,
  shelfRepository,
};
