const Lot = require("../../src/models/lot");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const Warehouse = require("../../src/models/warehouse");
const Shelf = require("../../src/models/shelf");
const ShelfSection = require("../../src/models/shelf-section");
const User = require("../../src/models/user");
const { createProduct } = require("./products");
const { createItemState } = require("./item-states");
const {
  as,
  createSection,
  createShelf,
  createWarehouse,
  tokenFor,
} = require("./shelves");

/**
 * Generates a unique lot number.
 * @param {string} [prefix] - Optional prefix.
 * @returns {string} The generated number.
 */
function uniqueNumber(prefix = "L") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

/**
 * Creates the complete physical location used by a lot.
 * @param {object} [overrides] - Location overrides.
 * @returns {Promise<{ warehouse: object, shelf: object, section: object }>}
 *   The created location rows.
 */
async function createLocation(overrides = {}) {
  const warehouse =
    overrides.warehouse ?? (await createWarehouse(overrides.warehouseData));
  const shelf =
    overrides.shelf ?? (await createShelf(warehouse.id, overrides.shelfData));
  const section =
    overrides.section ?? (await createSection(shelf.id, overrides.sectionData));

  return { warehouse, shelf, section };
}

/**
 * Creates the references required by a lot directly in the database.
 * @param {object} [overrides] - Reference overrides.
 * @returns {Promise<object>} The created references.
 */
async function createReferences(overrides = {}) {
  const location = await createLocation(overrides);
  const product =
    overrides.product ?? (await createProduct(overrides.productData));
  const itemState =
    overrides.itemState ??
    (await createItemState({
      name: `sellable-${Math.random().toString(36).slice(2, 8)}`,
      ...overrides.itemStateData,
    }));

  return { ...location, product, itemState };
}

/**
 * Creates a lot directly in the database.
 * @param {object} references - References returned by `createReferences`.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createLot(references, overrides = {}) {
  return Lot.create({
    number: uniqueNumber(),
    product_id: references.product.id,
    expiration_date: "2027-03-31",
    item_state_id: references.itemState.id,
    stock: 0,
    reserved: 0,
    warehouse_id: references.warehouse.id,
    shelf_id: references.shelf.id,
    section_id: references.section.id,
    ...overrides,
  });
}

/**
 * Builds the body of a valid lot creation request.
 * @param {object} references - References returned by `createReferences`.
 * @param {object} [overrides] - Body overrides.
 * @returns {object} The request body.
 */
function lotBody(references, overrides = {}) {
  return {
    number: uniqueNumber(),
    product_id: references.product.id,
    expiration_date: "2027-03-31",
    item_state_id: references.itemState.id,
    stock: 120,
    reserved: 15,
    warehouse_id: references.warehouse.id,
    shelf_id: references.shelf.id,
    section_id: references.section.id,
    ...overrides,
  };
}

/**
 * Truncates every table used by the lots suites. Lots go first because the
 * restrictive foreign keys protect products, states, warehouses and shelves.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  for (const model of [
    Lot,
    ShelfSection,
    Shelf,
    Warehouse,
    Product,
    Category,
    Image,
    ItemState,
    User,
  ]) {
    await model.destroy({
      where: {},
      truncate: { cascade: true, restartIdentity: true },
    });
  }
}

module.exports = {
  as,
  createItemState,
  createLocation,
  createLot,
  createProduct,
  createReferences,
  createSection,
  createShelf,
  createWarehouse,
  lotBody,
  resetDatabase,
  tokenFor,
  uniqueNumber,
};
