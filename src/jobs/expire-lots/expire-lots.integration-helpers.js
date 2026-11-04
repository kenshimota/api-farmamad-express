const Lot = require("../../models/lot");
const Stock = require("../../models/stock");
const ItemState = require("../../models/item-state");
const Product = require("../../models/product");
const Category = require("../../models/category");
const Image = require("../../models/image");
const Tax = require("../../models/tax");
const Cost = require("../../models/cost");
const Warehouse = require("../../models/warehouse");
const Shelf = require("../../models/shelf");
const ShelfSection = require("../../models/shelf-section");
const OrderItemLotAllocation = require("../../models/order-item-lot-allocation");
const PurchaseItem = require("../../models/purchase-item");
const { createProduct } = require("../../../test/helpers/products");
const {
  createSection,
  createShelf,
  createWarehouse,
} = require("../../../test/helpers/shelves");

const RESET_MODELS = Object.freeze([
  OrderItemLotAllocation,
  PurchaseItem,
  Lot,
  Stock,
  Cost,
  Product,
  Category,
  Image,
  Tax,
  ShelfSection,
  Shelf,
  Warehouse,
  ItemState,
]);

/**
 * Returns a YYYY-MM-DD date relative to today in UTC.
 * @param {number} offsetDays - Days to add; negative values are in the past.
 * @returns {string} The date-only string.
 */
function dateFromToday(offsetDays) {
  const date = new Date();

  date.setUTCDate(date.getUTCDate() + offsetDays);

  return date.toISOString().slice(0, 10);
}

/**
 * Creates an item state with the given sellable flag.
 * @param {string} name - Stable state name.
 * @param {boolean} isSellable - Whether the state is sellable.
 * @returns {Promise<object>} The created state.
 */
function createState(name, isSellable) {
  return ItemState.create({
    name,
    label: name,
    description: null,
    is_sellable: isSellable,
  });
}

/**
 * Creates a warehouse, shelf and section.
 * @returns {Promise<object>} The created location.
 */
async function createLocation() {
  const warehouse = await createWarehouse();
  const shelf = await createShelf(warehouse.id);
  const section = await createSection(shelf.id);

  return { warehouse, shelf, section };
}

/**
 * Creates a lot directly in the database.
 * @param {object} options - Lot data.
 * @returns {Promise<object>} The created lot.
 */
function createLot({
  product,
  itemState,
  location,
  expirationDate,
  stock = 0,
  reserved = 0,
  locationStatus = "located",
}) {
  const located = locationStatus === "located";

  return Lot.create({
    number: `L-${Math.random().toString(36).slice(2, 10)}`.toUpperCase(),
    product_id: product.id,
    expiration_date: expirationDate,
    item_state_id: itemState.id,
    stock,
    reserved,
    warehouse_id: located ? location.warehouse.id : null,
    shelf_id: located ? location.shelf.id : null,
    section_id: located ? location.section.id : null,
    location_status: locationStatus,
    located_at: located ? new Date() : null,
  });
}

/**
 * Builds the common product/location/state fixture.
 * @returns {Promise<object>} The fixture.
 */
async function createFixture() {
  const product = await createProduct({
    reference: `JOB-${Math.random().toString(36).slice(2, 8)}`,
  });
  const location = await createLocation();
  const sellable = await createState("sellable", true);
  const expired = await createState("expired", false);
  const damaged = await createState("damaged", false);

  return { product, location, sellable, expired, damaged };
}

module.exports = {
  RESET_MODELS,
  createFixture,
  createLocation,
  createLot,
  createState,
  dateFromToday,
};
