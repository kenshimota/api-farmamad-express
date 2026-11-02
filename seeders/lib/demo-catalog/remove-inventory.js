const { Op } = require("sequelize");
const Cost = require("../../../src/models/cost");
const Image = require("../../../src/models/image");
const Lot = require("../../../src/models/lot");
const Product = require("../../../src/models/product");
const Stock = require("../../../src/models/stock");
const { options } = require("./helpers");

const PRODUCT_REFERENCE_TABLES = Object.freeze([
  "purchase_items",
  "order_items",
  "invoice_items",
]);
const DEMO_LOT_PATTERN = "LOTE-DEMO-%";
const LOT_ALLOCATIONS_TABLE = "order_item_lot_allocations";

/**
 * Tells whether a table has at least one row matching the condition.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Table name.
 * @param {object} where - Condition.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<boolean>} True when a row exists.
 */
async function hasRows(queryInterface, table, where, transaction) {
  const id = await queryInterface.rawSelect(
    table,
    { where, ...options(transaction) },
    ["id"],
  );

  return id !== undefined && id !== null;
}

/**
 * Fails when a table still references rows that are about to be deleted.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string} table - Table name.
 * @param {object} where - Condition.
 * @param {object|null} transaction - Sequelize transaction.
 * @param {string} message - Actionable error message.
 * @returns {Promise<void>} Resolves when no row matches.
 * @throws {Error} When the table has a matching row.
 */
async function assertNoRows(
  queryInterface,
  table,
  where,
  transaction,
  message,
) {
  if (await hasRows(queryInterface, table, where, transaction)) {
    throw new Error(message);
  }
}

/**
 * Loads the demo products that are still present in the database.
 * @param {string[]} references - Stable demo references.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object[]>} Demo product instances.
 */
function findDemoProducts(references, transaction) {
  return Product.findAll({
    where: { reference: { [Op.in]: references } },
    ...options(transaction),
  });
}

/**
 * Refuses to remove products that real purchase, order or invoice rows use.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {number[]} ids - Demo product ids.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<void>} Resolves when products are unreferenced.
 */
async function assertProductsNotReferenced(queryInterface, ids, transaction) {
  for (const table of PRODUCT_REFERENCE_TABLES) {
    await assertNoRows(
      queryInterface,
      table,
      { product_id: { [Op.in]: ids } },
      transaction,
      `Cannot remove the demo catalog: products are referenced by ${table}. Remove or reassign those rows first.`,
    );
  }
}

/**
 * Loads the demo lots of the given products.
 * @param {number[]} ids - Demo product ids.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object[]>} Demo lot instances.
 */
function findDemoLots(ids, transaction) {
  return Lot.findAll({
    where: {
      product_id: { [Op.in]: ids },
      number: { [Op.like]: DEMO_LOT_PATTERN },
    },
    ...options(transaction),
  });
}

/**
 * Deletes costs, stocks and lots of the demo products, in dependency order.
 * @param {number[]} ids - Demo product ids.
 * @param {number[]} lotIds - Demo lot ids.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<number>} Removed cost count.
 */
async function removeInventoryRows(ids, lotIds, transaction) {
  const costCount = await Cost.destroy({
    where: { product_id: { [Op.in]: ids } },
    ...options(transaction),
  });
  await Stock.destroy({
    where: { product_id: { [Op.in]: ids } },
    ...options(transaction),
  });
  await Lot.destroy({
    where: { id: { [Op.in]: lotIds } },
    ...options(transaction),
  });

  return costCount;
}

/**
 * Deletes the demo images that no real product uses.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {string[]} references - Stable demo image references.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<number>} Removed image count.
 */
async function removeDemoImages(queryInterface, references, transaction) {
  const images = await Image.findAll({
    where: { reference: { [Op.in]: references } },
    ...options(transaction),
  });
  const imageIds = images.map((item) => item.id);

  if (imageIds.length > 0) {
    await assertNoRows(
      queryInterface,
      "products",
      { image_id: { [Op.in]: imageIds } },
      transaction,
      "Cannot remove the demo catalog: images are referenced by real products.",
    );
  }

  await Image.destroy({
    where: { id: { [Op.in]: imageIds } },
    ...options(transaction),
  });

  return images.length;
}

module.exports = {
  DEMO_LOT_PATTERN,
  LOT_ALLOCATIONS_TABLE,
  PRODUCT_REFERENCE_TABLES,
  assertNoRows,
  assertProductsNotReferenced,
  findDemoLots,
  findDemoProducts,
  hasRows,
  removeDemoImages,
  removeInventoryRows,
};
