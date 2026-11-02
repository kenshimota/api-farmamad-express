const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const Currency = require("../../src/models/currency");
const Cost = require("../../src/models/cost");
const Stock = require("../../src/models/stock");
const Lot = require("../../src/models/lot");
const Warehouse = require("../../src/models/warehouse");
const Shelf = require("../../src/models/shelf");
const ShelfSection = require("../../src/models/shelf-section");
const { ensureDefaultTax } = require("./products");
const { ensureDefaultTransactionCurrency } = require("./currency-default");

/**
 * Generates a unique suffix for fixture values.
 * @param {string} [prefix] - Optional prefix.
 * @returns {string} The unique suffix.
 */
function unique(prefix = "O") {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

/**
 * Creates an item state.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created item state.
 */
function createItemState(overrides = {}) {
  const suffix = unique("S");

  return ItemState.create({
    name: `state_${suffix}`.slice(0, 50),
    label: `Estado ${suffix}`.slice(0, 100),
    is_sellable: true,
    ...overrides,
  });
}

/**
 * Creates a product with its category and image.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created product.
 */
async function createProduct(overrides = {}) {
  const suffix = unique("P");
  const category = await Category.create({ name: `Categoría ${suffix}` });
  const image = await Image.create({
    url: `https://cdn.farmamad.com/products/${suffix}.png`,
    pathname: `/uploads/products/${suffix}.png`,
    reference: `image-${suffix}`,
    thumbnail: `https://cdn.farmamad.com/products/${suffix}-thumb.png`,
  });
  const tax = await ensureDefaultTax();

  return Product.create({
    name: `Ibuprofeno ${suffix}`,
    description: "Analgésico",
    reference: `REF-${suffix}`,
    category_id: category.id,
    image_id: image.id,
    tax_id: tax.id,
    ...overrides,
  });
}

/**
 * Creates an active currency.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created currency.
 */
function createCurrency(overrides = {}) {
  const suffix = unique("CUR");

  return Currency.create({
    code: suffix.slice(0, 10),
    name: `Moneda ${suffix}`,
    symbol: "$",
    rate: "1.000000",
    is_base: false,
    is_active: true,
    is_default_for_transactions: false,
    ...overrides,
  });
}

/**
 * Creates the current cost of a product/state pair.
 * @param {object} product - Product instance.
 * @param {object} itemState - Item state instance.
 * @param {object} [options] - Cost options.
 * @param {string} [options.cost] - Cost amount.
 * @param {object} [options.currency] - Cost currency.
 * @returns {Promise<object>} The created cost.
 */
async function createCost(
  product,
  itemState,
  { cost = "10.00", currency } = {},
) {
  const currencyId = (currency ?? (await ensureDefaultTransactionCurrency()))
    .id;

  return Cost.create({
    product_id: product.id,
    item_state_id: itemState.id,
    cost,
    currency_id: currencyId,
  });
}

/**
 * Creates a physical location for lots.
 * @returns {Promise<object>} Warehouse, shelf and section.
 */
async function createLocation() {
  const suffix = unique("L");
  const warehouse = await Warehouse.create({
    name: `Bodega ${suffix}`,
    address: "Av. Monseñor Rivero 123",
  });
  const shelf = await Shelf.create({
    warehouse_id: warehouse.id,
    code: `A${suffix}`,
    name: null,
    description: null,
  });
  const section = await ShelfSection.create({
    shelf_id: shelf.id,
    code: `C${suffix}`,
    name: null,
    description: null,
  });

  return { warehouse, shelf, section };
}

/**
 * Creates a lot for a product/state pair.
 * @param {object} product - Product instance.
 * @param {object} itemState - Item state instance.
 * @param {object} location - Location returned by `createLocation`.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created lot.
 */
function createLot(product, itemState, location, overrides = {}) {
  return Lot.create({
    number: unique("LOT"),
    product_id: product.id,
    item_state_id: itemState.id,
    expiration_date: "2027-03-31",
    stock: 0,
    reserved: 0,
    warehouse_id: location.warehouse.id,
    shelf_id: location.shelf.id,
    section_id: location.section.id,
    ...overrides,
  });
}

/**
 * Creates the stock row for a product/state pair.
 * @param {object} product - Product instance.
 * @param {object} itemState - Item state instance.
 * @param {number} quantity - Physical quantity.
 * @returns {Promise<object>} The created stock.
 */
function createStock(product, itemState, quantity) {
  return Stock.create({
    product_id: product.id,
    item_state_id: itemState.id,
    quantity,
  });
}

module.exports = {
  createCost,
  createCurrency,
  createItemState,
  createLocation,
  createLot,
  createProduct,
  createStock,
  unique,
};
