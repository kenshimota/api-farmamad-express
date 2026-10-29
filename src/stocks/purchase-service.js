const Stock = require("../models/stock");

/**
 * Validates and groups the purchase items by product and item state so the
 * same pair is incremented only once per confirmation. The result is sorted so
 * every confirmation locks rows in the same order, which prevents deadlocks
 * between concurrent purchases that share pairs.
 * @param {object[]} items - Purchase items with product_id, item_state_id and
 *   quantity.
 * @returns {{ product_id: number, item_state_id: number, quantity: number }[]}
 *   Normalized and aggregated rows ordered by product and item state.
 * @throws {TypeError} When the list or any item is invalid.
 */
function normalizeItems(items) {
  if (!Array.isArray(items)) {
    throw new TypeError("items must be an array");
  }

  const grouped = new Map();

  for (const item of items) {
    const productId = item?.product_id;
    const itemStateId = item?.item_state_id;
    const quantity = item?.quantity;

    if (!Number.isInteger(productId) || productId < 1) {
      throw new TypeError("Invalid product_id");
    }

    if (!Number.isInteger(itemStateId) || itemStateId < 1) {
      throw new TypeError("Invalid item_state_id");
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new TypeError("Invalid quantity");
    }

    const key = `${productId}:${itemStateId}`;
    const current = grouped.get(key);

    if (current) {
      current.quantity += quantity;
    } else {
      grouped.set(key, {
        product_id: productId,
        item_state_id: itemStateId,
        quantity,
      });
    }
  }

  return [...grouped.values()].sort(
    (left, right) =>
      left.product_id - right.product_id ||
      left.item_state_id - right.item_state_id,
  );
}

/**
 * Creates the transactional service that feeds stocks from confirmed
 * purchases (HU-21). The stock model is injectable to keep it unit testable.
 * @param {object} [stockModel] - Sequelize stock model.
 * @returns {{ applyPurchaseItems: Function }} The stock purchase service.
 */
function createPurchaseStockService(stockModel = Stock) {
  /**
   * Adds the item quantities to the stock of each `(product_id,
   * item_state_id)` pair inside the received transaction. Missing rows are
   * created and existing rows are incremented atomically; a row lock prevents
   * two concurrent purchases from losing an increment.
   * @param {object[]} items - Purchase items to apply.
   * @param {object} options - Options supplied by the caller.
   * @param {object} options.transaction - Open Sequelize transaction; it is
   *   required so a failing item rolls back every stock change.
   * @returns {Promise<object[]>} The touched stock instances.
   * @throws {TypeError} When the transaction is missing or an item is invalid.
   */
  async function applyPurchaseItems(items, { transaction } = {}) {
    if (!transaction) {
      throw new TypeError("A transaction is required");
    }

    const rows = normalizeItems(items);
    const touched = [];

    for (const row of rows) {
      const [stock, created] = await stockModel.findOrCreate({
        where: {
          product_id: row.product_id,
          item_state_id: row.item_state_id,
        },
        defaults: { quantity: row.quantity },
        transaction,
        lock: transaction.LOCK?.UPDATE,
      });

      if (!created) {
        await stock.increment("quantity", {
          by: row.quantity,
          transaction,
        });
      }

      touched.push(stock);
    }

    return touched;
  }

  return { applyPurchaseItems };
}

module.exports = { createPurchaseStockService, normalizeItems };
