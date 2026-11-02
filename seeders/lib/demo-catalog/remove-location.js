const { Op } = require("sequelize");
const Category = require("../../../src/models/category");
const Product = require("../../../src/models/product");
const Shelf = require("../../../src/models/shelf");
const ShelfSection = require("../../../src/models/shelf-section");
const Supplier = require("../../../src/models/supplier");
const Warehouse = require("../../../src/models/warehouse");
const { options } = require("./helpers");
const { SECTIONS, SUPPLIER, WAREHOUSE } = require("./location");
const { assertNoRows } = require("./remove-inventory");

/**
 * Deletes the demo supplier unless a real purchase uses it.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<void>} Resolves after the removal.
 */
async function removeDemoSupplier(queryInterface, transaction) {
  const supplier = await Supplier.findOne({
    where: { identification: { [Op.iLike]: SUPPLIER.identification } },
    ...options(transaction),
  });

  if (!supplier) {
    return;
  }

  await assertNoRows(
    queryInterface,
    "purchases",
    { supplier_id: supplier.id },
    transaction,
    "Cannot remove the demo catalog: the demo supplier is referenced by purchases.",
  );
  await supplier.destroy(options(transaction));
}

/**
 * Deletes the demo warehouse, shelves and sections unless real lots use them.
 * @param {object} queryInterface - Sequelize query interface.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<void>} Resolves after the removal.
 */
async function removeDemoLocation(queryInterface, transaction) {
  const warehouse = await Warehouse.findOne({
    where: { name: WAREHOUSE.name, address: WAREHOUSE.address },
    ...options(transaction),
  });
  const shelves = warehouse
    ? await Shelf.findAll({
        where: {
          warehouse_id: warehouse.id,
          code: {
            [Op.in]: [...new Set(SECTIONS.map((item) => item.shelf))],
          },
        },
        ...options(transaction),
      })
    : [];
  const shelfIds = shelves.map((item) => item.id);
  const sections = await ShelfSection.findAll({
    where: { shelf_id: { [Op.in]: shelfIds } },
    ...options(transaction),
  });
  const sectionIds = sections.map((item) => item.id);
  const locationFilter = {
    [Op.or]: [
      { warehouse_id: warehouse?.id ?? null },
      { shelf_id: { [Op.in]: shelfIds } },
      { section_id: { [Op.in]: sectionIds } },
    ],
  };

  if (warehouse || shelfIds.length || sectionIds.length) {
    await assertNoRows(
      queryInterface,
      "lots",
      locationFilter,
      transaction,
      "Cannot remove the demo catalog: its warehouse, shelves or sections are referenced by real lots.",
    );
  }

  await ShelfSection.destroy({
    where: { id: { [Op.in]: sectionIds } },
    ...options(transaction),
  });
  await Shelf.destroy({
    where: { id: { [Op.in]: shelfIds } },
    ...options(transaction),
  });

  if (warehouse) {
    await warehouse.destroy(options(transaction));
  }
}

/**
 * Deletes demo categories that no remaining product uses.
 * @param {string[]} names - Demo category names.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<void>} Resolves after the cleanup.
 */
async function removeUnusedCategories(names, transaction) {
  const categories = await Category.findAll({
    where: { name: { [Op.in]: names } },
    ...options(transaction),
  });

  for (const category of categories) {
    const used = await Product.count({
      where: { category_id: category.id },
      ...options(transaction),
    });

    if (used === 0) {
      await category.destroy(options(transaction));
    }
  }
}

module.exports = {
  removeDemoLocation,
  removeDemoSupplier,
  removeUnusedCategories,
};
