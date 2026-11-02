const { QueryTypes } = require("sequelize");
const sequelize = require("../database");
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchase-item");
const Supplier = require("../models/supplier");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const { findPage } = require("../shared/pagination");
const {
  CURRENCY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  SORT_FIELDS,
  buildListOptions,
} = require("./list-options");

const SUPPLIER_INCLUDE = Object.freeze({
  model: Supplier,
  as: "supplier",
});

/**
 * Creates a repository that encapsulates every persistence call of the
 * purchases module. The models and the Sequelize instance are injectable to
 * keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Purchase model.
 * @param {object} [options.itemModel] - PurchaseItem model.
 * @param {object} [options.supplierModel] - Supplier model.
 * @param {object} [options.productModel] - Product model.
 * @param {object} [options.itemStateModel] - ItemState model.
 * @param {object} [options.costModel] - Cost model.
 * @param {object} [options.db] - Shared Sequelize instance.
 * @returns {object} Purchase repository.
 */
function createPurchaseRepository({
  model = Purchase,
  itemModel = PurchaseItem,
  supplierModel = Supplier,
  productModel = Product,
  itemStateModel = ItemState,
  costModel = Cost,
  db = sequelize,
} = {}) {
  /**
   * Loads a purchase by primary key.
   * @param {number} id - Purchase id.
   * @param {object} [options] - Query options.
   * @param {boolean} [options.includeItems] - Nest the lines.
   * @param {boolean} [options.includeSupplier] - Nest the supplier.
   * @param {object} [options.transaction] - Open transaction.
   * @param {string} [options.lock] - Row lock mode.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(
    id,
    { includeItems = false, includeSupplier = false, transaction, lock } = {},
  ) {
    const include = [{ ...CURRENCY_INCLUDE }];

    if (includeItems) {
      include.push({ ...ITEM_INCLUDE });
    }

    if (includeSupplier) {
      include.push({ ...SUPPLIER_INCLUDE });
    }

    return model.findByPk(id, {
      include,
      transaction,
      lock,
    });
  }

  return {
    /**
     * Starts a transaction with the shared Sequelize instance.
     * @param {Function} callback - Work to run inside the transaction.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return db.transaction(callback);
    },

    /**
     * Reserves the next ascending purchase number from the PostgreSQL
     * sequence. `sequelize.query` is used instead of the raw `pg` driver so
     * the call participates in the current transaction.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<number>} The reserved number.
     */
    async nextNumber(transaction) {
      const [row] = await db.query(
        "SELECT nextval('purchases_number_seq') AS \"number\"",
        { type: QueryTypes.SELECT, transaction },
      );

      return Number(row.number);
    },

    /**
     * Persists a purchase.
     * @param {object} values - Purchase attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The created instance.
     */
    create(values, { transaction } = {}) {
      return model.create(values, { transaction });
    },

    /**
     * Lists purchases ordered by number descending.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching instances.
     */
    list(filters, { pagination, order = LIST_ORDER } = {}) {
      return findPage(model, buildListOptions(filters, order), pagination);
    },

    findById,

    /**
     * Loads a purchase and locks its row inside a transaction, so concurrent
     * mutations of the same draft are serialized.
     * @param {number} id - Purchase id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked instance or null.
     */
    findByIdForUpdate(id, transaction) {
      // Lock only the purchase row: `FOR UPDATE` cannot be combined with the
      // nullable side of the currency outer join. The caller reloads the
      // associations after the update.
      return model.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    },

    /**
     * Persists changes on an existing purchase.
     * @param {object} purchase - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(purchase, values, { transaction } = {}) {
      return purchase.update(values, { transaction });
    },

    /**
     * Deletes a purchase. The `purchase_items` foreign key cascades.
     * @param {object} purchase - Loaded instance.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(purchase, { transaction } = {}) {
      return purchase.destroy({ transaction });
    },

    /**
     * Tells whether a supplier exists.
     * @param {number} id - Supplier id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async supplierExists(id) {
      const supplier = await supplierModel.findByPk(id);

      return supplier !== null && supplier !== undefined;
    },

    /**
     * Tells whether a product exists.
     * @param {number} id - Product id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async productExists(id) {
      const product = await productModel.findByPk(id);

      return product !== null && product !== undefined;
    },

    /**
     * Tells whether an item state exists.
     * @param {number} id - Item state id.
     * @returns {Promise<boolean>} True when the row exists.
     */
    async itemStateExists(id) {
      const itemState = await itemStateModel.findByPk(id);

      return itemState !== null && itemState !== undefined;
    },

    /**
     * Upserts the current cost of the product/item state pair; the latest
     * confirmed purchase wins.
     * @param {object} values - Product, item state, unit cost and currency.
     * @param {object} options - Persistence options.
     * @param {object} options.transaction - Open transaction.
     * @returns {Promise<unknown>} The upsert result.
     */
    upsertCost(values, { transaction } = {}) {
      return costModel.upsert(
        {
          product_id: values.product_id,
          item_state_id: values.item_state_id,
          cost: values.unit_cost,
          currency_id: values.currency_id,
        },
        { transaction, conflictFields: ["product_id", "item_state_id"] },
      );
    },
  };
}

const purchaseRepository = createPurchaseRepository();

module.exports = {
  CURRENCY_INCLUDE,
  ITEM_INCLUDE,
  LIST_ORDER,
  SORT_FIELDS,
  SUPPLIER_INCLUDE,
  buildListOptions,
  createPurchaseRepository,
  purchaseRepository,
};
