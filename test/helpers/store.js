const PriceList = require("../../src/models/price-list");
const Customer = require("../../src/models/customer");
const User = require("../../src/models/user");
const CustomerSeller = require("../../src/models/customer-seller");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const Cost = require("../../src/models/cost");
const Stock = require("../../src/models/stock");
const Lot = require("../../src/models/lot");
const ShelfSection = require("../../src/models/shelf-section");
const Shelf = require("../../src/models/shelf");
const Warehouse = require("../../src/models/warehouse");
const { createProduct } = require("./products");
const { createItemState } = require("./item-states");
const { createLocation } = require("./lots");
const { as, createAssignment, createActor } = require("./customer-sellers");
const { ensureDefaultTransactionCurrency } = require("./currency-default");

const CUSTOMER_BODY = {
  fullName: "Cliente Tienda",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "tienda@example.com",
};

/**
 * Generates a short suffix for unique catalog names.
 * @returns {string} Random suffix.
 */
function suffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Creates a price list directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createPriceList(overrides = {}) {
  return PriceList.create({
    name: `Lista ${suffix()}`,
    description: null,
    percentage: 30,
    ...overrides,
  });
}

/**
 * Creates a customer, optionally linked to a price list.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createCustomer(overrides = {}) {
  return Customer.create({
    ...CUSTOMER_BODY,
    email: `tienda-${suffix()}@example.com`,
    ...overrides,
  });
}

/**
 * Creates a customer user linked to a customer profile.
 * @param {object} customer - Customer instance.
 * @param {object} [overrides] - User overrides.
 * @returns {Promise<{ user: object, token: string }>} The actor.
 */
function createCustomerUser(customer, overrides = {}) {
  return createActor("customer", { customer_id: customer.id, ...overrides });
}

/**
 * Creates a seller user assigned to a customer.
 * @param {object} customer - Customer instance.
 * @param {object} [overrides] - Seller overrides.
 * @returns {Promise<{ user: object, token: string }>} The actor.
 */
async function createAssignedSeller(customer, overrides = {}) {
  const seller = await createActor("seller", overrides);

  await createAssignment(customer, seller.user);

  return seller;
}

/**
 * Creates a product with category and image.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createStoreProduct(overrides = {}) {
  return createProduct({
    reference: `STORE-${suffix()}`.toUpperCase(),
    ...overrides,
  });
}

/**
 * Creates an item state.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createStoreItemState(overrides = {}) {
  return createItemState({
    name: `sellable-${suffix()}`,
    is_sellable: true,
    ...overrides,
  });
}

/**
 * Creates the warehouse, shelf and section required by a lot.
 * @returns {Promise<object>} The location rows.
 */
function createStoreLocation() {
  return createLocation();
}

/**
 * Creates a cost using the active default transaction currency unless another
 * currency is supplied.
 * @param {object} references - Product and item state.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
async function createStoreCost(references, overrides = {}) {
  const currency = await ensureDefaultTransactionCurrency();

  return Cost.create({
    product_id: references.product.id,
    item_state_id: references.itemState.id,
    cost: 10,
    currency_id: currency.id,
    ...overrides,
  });
}

/**
 * Creates a stock row with the given quantity.
 * @param {object} references - Product and item state.
 * @param {number} quantity - Stored quantity.
 * @returns {Promise<object>} The created instance.
 */
function createStoreStock(references, quantity) {
  return Stock.create({
    product_id: references.product.id,
    item_state_id: references.itemState.id,
    quantity,
  });
}

/**
 * Creates a lot in the given location with stock and reserved quantities.
 * @param {object} references - Product, item state and location.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createStoreLot(references, overrides = {}) {
  return Lot.create({
    number: `L-${suffix()}`.toUpperCase(),
    product_id: references.product.id,
    expiration_date: "2027-12-31",
    item_state_id: references.itemState.id,
    stock: 10,
    reserved: 0,
    warehouse_id: references.warehouse.id,
    shelf_id: references.shelf.id,
    section_id: references.section.id,
    ...overrides,
  });
}

/**
 * Builds the full fixture of one product variant: product, state, location,
 * cost, stock and one lot.
 * @param {object} [options] - Fixture options.
 * @param {number} [options.cost] - Cost amount.
 * @param {number} [options.stock] - Stock quantity.
 * @param {number} [options.reserved] - Reserved quantity.
 * @param {object} [options.product] - Product overrides.
 * @param {object} [options.itemState] - Item state overrides.
 * @param {number} [options.stockQuantity] - Override for the stock row.
 * @returns {Promise<object>} The created references.
 */
async function createVariant({
  cost = 10,
  stock = 10,
  reserved = 0,
  product: productOverrides = {},
  itemState: itemStateOverrides = {},
  stockQuantity,
} = {}) {
  const product = await createStoreProduct(productOverrides);
  const itemState = await createStoreItemState(itemStateOverrides);
  const location = await createStoreLocation();
  const references = { product, itemState, ...location };

  await createStoreCost(references, { cost });
  await createStoreStock(references, stockQuantity ?? stock);
  await createStoreLot(references, { stock, reserved });

  return references;
}

/**
 * Truncates every table used by the store suites. Rows with restrictive
 * foreign keys are removed first and the default currency is restored.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetStoreDatabase() {
  for (const model of [
    Lot,
    Stock,
    Cost,
    CustomerSeller,
    User,
    Product,
    Category,
    Image,
    ItemState,
    Customer,
    PriceList,
    ShelfSection,
    Shelf,
    Warehouse,
  ]) {
    await model.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });
  }

  await ensureDefaultTransactionCurrency();
}

module.exports = {
  CUSTOMER_BODY,
  as,
  createAssignedSeller,
  createCustomer,
  createCustomerUser,
  createPriceList,
  createStoreCost,
  createStoreItemState,
  createStoreLocation,
  createStoreLot,
  createStoreProduct,
  createStoreStock,
  createVariant,
  resetStoreDatabase,
  suffix,
};
