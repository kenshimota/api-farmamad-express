const { Op } = require("sequelize");
const sequelize = require("../database");
const Lot = require("../models/lot");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const PurchaseItem = require("../models/purchase-item");
const Purchase = require("../models/purchase");
const User = require("../models/user");
const Warehouse = require("../models/warehouse");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");

const LIST_ORDER = Object.freeze([
  ["createdAt", "ASC"],
  ["id", "ASC"],
]);
const DEFAULT_STATUSES = Object.freeze(["pending", "in_progress"]);

/**
 * Builds the eager-loading graph of the inbox rows. The purchase item carries
 * the purchase, so the client can link the lot back to the purchase that
 * received it without an extra request.
 * @param {number} [purchaseId] - Optional exact purchase filter.
 * @returns {object[]} The Sequelize include options.
 */
function buildIncludes(purchaseId) {
  const purchaseItems = {
    model: PurchaseItem,
    as: "purchase_items",
    attributes: ["id", "purchase_id"],
    required: purchaseId !== undefined,
    include: [
      {
        model: Purchase,
        as: "purchase",
        attributes: ["id", "number", "supplier_id"],
      },
    ],
  };

  if (purchaseId !== undefined) {
    purchaseItems.where = { purchase_id: purchaseId };
  }

  return [
    { model: Product, as: "product", attributes: ["id", "name", "reference"] },
    {
      model: ItemState,
      as: "item_state",
      attributes: ["id", "name", "label"],
    },
    purchaseItems,
    { model: User, as: "started_by", attributes: ["id", "username"] },
    { model: User, as: "located_by_user", attributes: ["id", "username"] },
  ];
}

/**
 * Builds the `where` clause of the inbox listing.
 * @param {object} filters - Listing filters.
 * @returns {object} The Sequelize condition.
 */
function buildWhere({ productId, lotNumber, status, expiringBefore } = {}) {
  const where = {};

  if (productId !== undefined) {
    where.product_id = productId;
  }

  if (lotNumber !== undefined) {
    where.number = { [Op.iLike]: lotNumber };
  }

  if (status === "all") {
    // No status filter: the contract's `all` value exposes every lifecycle.
  } else if (status !== undefined) {
    where.location_status = status;
  } else {
    where.location_status = { [Op.in]: [...DEFAULT_STATUSES] };
  }

  if (expiringBefore !== undefined) {
    where.expiration_date = { [Op.lte]: expiringBefore };
  }

  return where;
}

/**
 * Creates the repository of the warehouse inbox. Models and the connection are
 * injectable to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @returns {object} Warehouse inbox repository.
 */
function createInboxRepository({
  model = Lot,
  purchaseItemModel = PurchaseItem,
  warehouseModel = Warehouse,
  shelfModel = Shelf,
  sectionModel = ShelfSection,
  connection = sequelize,
} = {}) {
  return {
    /**
     * Runs a callback inside a database transaction.
     * @param {Function} callback - Work to execute.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return connection.transaction(callback);
    },

    /**
     * Lists the lots of the inbox with their relations.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching lots.
     */
    list(filters = {}) {
      const options = {
        where: buildWhere(filters),
        order: LIST_ORDER.map((order) => [...order]),
        include: buildIncludes(filters.purchaseId),
      };

      return model.findAll(options);
    },

    /**
     * Loads one lot with every inbox relation.
     * @param {number} id - Lot id.
     * @param {object} [options] - Sequelize options.
     * @returns {Promise<object|null>} The lot or null.
     */
    findById(id, options = {}) {
      return model.findByPk(id, {
        ...options,
        include: buildIncludes(),
      });
    },

    /**
     * Locks a lot row inside a transaction so the start/location transitions
     * cannot race each other.
     * @param {number} id - Lot id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked lot or null.
     */
    findForUpdate(id, transaction) {
      return model.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    },

    /**
     * Persists changes on a lot.
     * @param {object} lot - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(lot, values, transaction) {
      return lot.update(values, { transaction });
    },

    /**
     * Loads a warehouse by primary key.
     * @param {number} id - Warehouse id.
     * @param {object} options - Sequelize options.
     * @returns {Promise<object|null>} The warehouse or null.
     */
    findWarehouse(id, options = {}) {
      return warehouseModel.findByPk(id, options);
    },

    /**
     * Loads a shelf by primary key.
     * @param {number} id - Shelf id.
     * @param {object} options - Sequelize options.
     * @returns {Promise<object|null>} The shelf or null.
     */
    findShelf(id, options = {}) {
      return shelfModel.findByPk(id, options);
    },

    /**
     * Loads a shelf section by primary key.
     * @param {number} id - Section id.
     * @param {object} options - Sequelize options.
     * @returns {Promise<object|null>} The section or null.
     */
    findSection(id, options = {}) {
      return sectionModel.findByPk(id, options);
    },

    /**
     * Counts in a purchase-item relation, exposed for completeness of the
     * repository contract.
     * @returns {object} The purchase item model.
     */
    get purchaseItemModel() {
      return purchaseItemModel;
    },
  };
}

const inboxRepository = createInboxRepository();

module.exports = {
  DEFAULT_STATUSES,
  LIST_ORDER,
  buildIncludes,
  buildWhere,
  createInboxRepository,
  inboxRepository,
};
