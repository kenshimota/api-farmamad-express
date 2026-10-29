const { Op, Sequelize } = require("sequelize");
const sequelize = require("../database");
const Lot = require("../models/lot");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Warehouse = require("../models/warehouse");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const { buildIncludes } = require("./relations");

const LIST_ORDER = Object.freeze([
  ["expiration_date", "ASC"],
  ["id", "ASC"],
]);
const LOT_INCLUDES = Object.freeze(
  buildIncludes({
    product: Product,
    item_state: ItemState,
    warehouse: Warehouse,
    shelf: Shelf,
    section: ShelfSection,
  }),
);

/**
 * Builds the optional expiration conditions. `expired` and `expiring_before`
 * can be combined, so both predicates are added to the same AND group.
 * @param {object} filters - Listing filters.
 * @param {boolean} [filters.expired] - True for dates before today.
 * @param {string} [filters.expiringBefore] - Inclusive maximum date.
 * @returns {object|null} The Sequelize condition or null when absent.
 */
function expirationCondition({ expired, expiringBefore }) {
  const conditions = [];

  if (expired === true) {
    conditions.push({ [Op.lt]: Sequelize.literal("CURRENT_DATE") });
  }

  if (expired === false) {
    conditions.push({ [Op.gte]: Sequelize.literal("CURRENT_DATE") });
  }

  if (expiringBefore !== undefined) {
    conditions.push({ [Op.lte]: expiringBefore });
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  if (conditions.length > 1) {
    return { [Op.and]: conditions };
  }

  return null;
}

/**
 * Builds an existence checker for any Sequelize model, avoiding one identical
 * method per reference table.
 * @param {object} model - Sequelize model.
 * @returns {(id: number, options?: object) => Promise<boolean>} Checker.
 */
function existsChecker(model) {
  return async (id, options = {}) =>
    (await model.findByPk(id, options)) != null;
}

/**
 * Builds a primary key finder for any Sequelize model.
 * @param {object} model - Sequelize model.
 * @returns {(id: number, options?: object) => Promise<object|null>} Finder.
 */
function finder(model) {
  return (id, options = {}) => model.findByPk(id, options);
}

/**
 * Creates a repository that encapsulates every persistence call of the lots
 * module, including reference lookups and transactions. Models are injectable
 * to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Lot model.
 * @param {object} [options.productModel] - Product model.
 * @param {object} [options.itemStateModel] - Item state model.
 * @param {object} [options.warehouseModel] - Warehouse model.
 * @param {object} [options.shelfModel] - Shelf model.
 * @param {object} [options.sectionModel] - Shelf section model.
 * @param {object} [options.connection] - Sequelize connection.
 * @returns {object} Lot repository.
 */
function createLotRepository({
  model = Lot,
  productModel = Product,
  itemStateModel = ItemState,
  warehouseModel = Warehouse,
  shelfModel = Shelf,
  sectionModel = ShelfSection,
  connection = sequelize,
} = {}) {
  const productExists = existsChecker(productModel);
  const itemStateExists = existsChecker(itemStateModel);
  const warehouseExists = existsChecker(warehouseModel);
  const findShelf = finder(shelfModel);
  const findSection = finder(sectionModel);

  return {
    /**
     * Runs a callback inside a database transaction.
     * @param {(transaction: object) => Promise<unknown>} callback - Work.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return connection.transaction(callback);
    },

    /**
     * Persists a new lot.
     * @param {object} values - Validated lot attributes.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object>} The created instance.
     */
    create(values, options = {}) {
      return model.create(values, options);
    },

    /**
     * Finds a lot by primary key including the five documented relations.
     * @param {number} id - Lot id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id, options = {}) {
      return model.findByPk(id, { ...options, include: LOT_INCLUDES });
    },

    /**
     * Finds a lot with the same product and number ignoring case, optionally
     * excluding the lot being updated.
     * @param {object} values - Lookup values.
     * @param {number} values.productId - Product id.
     * @param {string} values.number - Lot number.
     * @param {number} [values.excludeId] - Lot id to ignore.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The matching instance or null.
     */
    findDuplicate({ productId, number, excludeId }, options = {}) {
      const where = {
        product_id: productId,
        number: { [Op.iLike]: number },
      };

      if (excludeId !== undefined) {
        where.id = { [Op.ne]: excludeId };
      }

      return model.findOne({ where, ...options });
    },

    /**
     * Lists lots ordered by expiration date and id, applying every optional
     * filter and eager-loading the five relations to avoid N+1 queries.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching instances.
     */
    list(filters = {}) {
      const where = {};
      const fields = {
        product_id: filters.productId,
        item_state_id: filters.itemStateId,
        warehouse_id: filters.warehouseId,
        shelf_id: filters.shelfId,
        section_id: filters.sectionId,
      };

      for (const [field, value] of Object.entries(fields)) {
        if (value !== undefined) {
          where[field] = value;
        }
      }

      if (filters.number !== undefined) {
        where.number = { [Op.iLike]: filters.number };
      }

      const expiration = expirationCondition(filters);

      if (expiration) {
        where.expiration_date = expiration;
      }

      const options = { order: LIST_ORDER, include: LOT_INCLUDES };

      if (Object.keys(where).length > 0) {
        options.where = where;
      }

      return model.findAll(options);
    },

    /**
     * Persists changes on an existing lot.
     * @param {object} lot - Loaded instance.
     * @param {object} values - Validated attributes to update.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(lot, values, options = {}) {
      return lot.update(values, options);
    },

    /**
     * Permanently removes an existing lot.
     * @param {object} lot - Loaded instance.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(lot, options = {}) {
      return lot.destroy(options);
    },

    // Reference checks built by the factory above: product, item state and
    // warehouse only need existence, while shelf and section are loaded to
    // validate their parent relationship.
    productExists,
    itemStateExists,
    warehouseExists,
    findShelf,
    findSection,
  };
}

const lotRepository = createLotRepository();

module.exports = {
  LIST_ORDER,
  LOT_INCLUDES,
  createLotRepository,
  expirationCondition,
  lotRepository,
};
