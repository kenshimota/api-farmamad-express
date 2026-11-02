const { Op } = require("sequelize");
const Product = require("../../../src/models/product");
const { DEFAULT_FIXTURE_PATH, loadFixture } = require("./fixture");
const { options } = require("./helpers");
const {
  LOT_ALLOCATIONS_TABLE,
  PRODUCT_REFERENCE_TABLES,
  assertNoRows,
  assertProductsNotReferenced,
  findDemoLots,
  findDemoProducts,
  removeDemoImages,
  removeInventoryRows,
} = require("./remove-inventory");
const {
  removeDemoLocation,
  removeDemoSupplier,
  removeUnusedCategories,
} = require("./remove-location");

/**
 * Removes the demo catalog in reverse dependency order, preserving shared
 * categories and refusing to delete rows referenced by real operations.
 * @param {object} settings - Removal settings.
 * @param {object} settings.queryInterface - Sequelize query interface.
 * @param {string} [settings.fixturePath] - Fixture file.
 * @returns {Promise<object>} Removed row counts.
 */
async function removeDemo({
  queryInterface,
  fixturePath = DEFAULT_FIXTURE_PATH,
} = {}) {
  if (!queryInterface) {
    throw new Error("removeDemo requires a Sequelize query interface.");
  }

  const { products } = await loadFixture(fixturePath);
  const references = products.map((item) => item.reference);
  const imageReferences = products.map((item) => item.image.reference);
  const categoryNames = [...new Set(products.map((item) => item.category))];

  const work = async (transaction) => {
    const demos = await findDemoProducts(references, transaction);

    if (demos.length === 0) {
      return { products: 0, images: 0, lots: 0 };
    }

    const ids = demos.map((item) => item.id);
    await assertProductsNotReferenced(queryInterface, ids, transaction);

    const lots = await findDemoLots(ids, transaction);
    const lotIds = lots.map((item) => item.id);

    if (lotIds.length > 0) {
      await assertNoRows(
        queryInterface,
        LOT_ALLOCATIONS_TABLE,
        { lot_id: { [Op.in]: lotIds } },
        transaction,
        "Cannot remove the demo catalog: lots are referenced by order_item_lot_allocations.",
      );
    }

    const costs = await removeInventoryRows(ids, lotIds, transaction);
    const productCount = await Product.destroy({
      where: { id: { [Op.in]: ids } },
      ...options(transaction),
    });
    const images = await removeDemoImages(
      queryInterface,
      imageReferences,
      transaction,
    );

    await removeDemoSupplier(queryInterface, transaction);
    await removeDemoLocation(queryInterface, transaction);
    await removeUnusedCategories(categoryNames, transaction);

    return {
      products: productCount,
      images,
      lots: lots.length,
      costs,
    };
  };

  const sequelize = queryInterface.sequelize;
  return sequelize?.transaction ? sequelize.transaction(work) : work(null);
}

module.exports = { PRODUCT_REFERENCE_TABLES, removeDemo };
