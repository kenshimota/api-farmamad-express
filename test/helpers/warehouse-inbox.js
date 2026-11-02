const Lot = require("../../src/models/lot");
const Purchase = require("../../src/models/purchase");
const PurchaseItem = require("../../src/models/purchase-item");
const OrderItemLotAllocation = require("../../src/models/order-item-lot-allocation");
const Stock = require("../../src/models/stock");
const Cost = require("../../src/models/cost");
const Supplier = require("../../src/models/supplier");
const City = require("../../src/models/city");
const State = require("../../src/models/state");
const { ensureDefaultTransactionCurrency } = require("./currency-default");
const {
  as,
  createItemState,
  createLocation,
  createLot,
  createProduct,
  createReferences,
  createSection,
  createShelf,
  createWarehouse,
  tokenFor,
  uniqueNumber,
} = require("./lots");
const { createPurchase, createPurchaseItem } = require("./purchases");

/**
 * Creates a lot in an explicit lifecycle state. Pending and in-progress lots
 * have no location; located lots use the provided location.
 * @param {object} references - References from `createReferences`.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created lot.
 */
function createInboxLot(references, overrides = {}) {
  const status = overrides.location_status ?? "pending";
  const located = status === "located";

  return Lot.create({
    number: uniqueNumber("INBOX"),
    product_id: references.product.id,
    expiration_date: "2027-03-31",
    item_state_id: references.itemState.id,
    stock: 50,
    reserved: 0,
    location_status: status,
    location_started_at:
      status === "in_progress" ? new Date("2026-11-02T15:00:00Z") : null,
    location_started_by: null,
    located_at: located ? new Date("2026-11-02T15:10:00Z") : null,
    located_by: null,
    warehouse_id: located ? references.warehouse.id : null,
    shelf_id: located ? references.shelf.id : null,
    section_id: located ? references.section.id : null,
    ...overrides,
  });
}

/**
 * Creates a purchase with one line linked to the received lot.
 * @param {object} references - References from `createReferences`.
 * @param {object} lot - Received lot.
 * @param {object} [overrides] - Line overrides.
 * @returns {Promise<{ purchase: object, item: object }>} The rows.
 */
async function createReceivedPurchase(references, lot, overrides = {}) {
  const purchase = await createPurchase({
    notes: "Purchase linked to inbox",
    status: "confirmed",
    confirmed_at: new Date("2026-11-02T15:00:00Z"),
  });
  const item = await createPurchaseItem({
    purchase_id: purchase.id,
    product_id: references.product.id,
    item_state_id: references.itemState.id,
    quantity: lot.stock,
    unit_cost: 10,
    subtotal: lot.stock * 10,
    lot_number: lot.number,
    expiration_date: lot.expiration_date,
    received_lot_id: lot.id,
    ...overrides,
  });

  return { purchase, item };
}

/**
 * Truncates every table used by the inbox and purchase suites.
 * @returns {Promise<void>} Resolves when the database is clean.
 */
async function resetInboxDatabase() {
  for (const model of [
    OrderItemLotAllocation,
    PurchaseItem,
    Purchase,
    Lot,
    Stock,
    Cost,
    Supplier,
    City,
    State,
  ]) {
    await model.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });
  }

  const { resetDatabase } = require("./lots");

  await resetDatabase();
  await ensureDefaultTransactionCurrency();
}

module.exports = {
  as,
  createInboxLot,
  createItemState,
  createLocation,
  createLot,
  createProduct,
  createReceivedPurchase,
  createReferences,
  createSection,
  createShelf,
  createWarehouse,
  resetInboxDatabase,
  tokenFor,
  uniqueNumber,
};
