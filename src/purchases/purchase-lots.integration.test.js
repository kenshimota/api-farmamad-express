process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Lot = require("../models/lot");
const Purchase = require("../models/purchase");
const Stock = require("../models/stock");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createItemState,
  createProduct,
  resetInboxDatabase,
  tokenFor,
} = require("../../test/helpers/warehouse-inbox");
const {
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
} = require("../../test/helpers/purchases");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetInboxDatabase();
});

afterAll(async () => {
  await resetInboxDatabase();
  await sequelize.close();
});

/**
 * Builds the references of a purchase confirmation.
 * @returns {Promise<object>} Supplier, product and item state.
 */
async function references() {
  return {
    supplier: await createPurchaseSupplier(),
    product: await createProduct(),
    itemState: await createItemState(),
  };
}

/**
 * Adds a line with lot data to a purchase.
 * @param {object} purchase - Purchase instance.
 * @param {object} refs - References.
 * @param {object} [overrides] - Line overrides.
 * @returns {Promise<object>} The created line.
 */
function addLine(purchase, refs, overrides = {}) {
  const quantity = overrides.quantity ?? 10;
  const unitCost = overrides.unit_cost ?? 20;

  return createPurchaseItem({
    purchase_id: purchase.id,
    product_id: refs.product.id,
    item_state_id: refs.itemState.id,
    quantity,
    unit_cost: unitCost,
    subtotal: quantity * unitCost,
    tax_amount: 0,
    lot_number: "LOTE-1",
    expiration_date: "2027-03-31",
    ...overrides,
  });
}

describe("purchase confirmation creates pending lots", () => {
  it("creates one pending lot per line and keeps stocks equal to SUM(lots.stock)", async () => {
    const refs = await references();
    const purchase = await createPurchase({
      supplier_id: refs.supplier.id,
    });
    await addLine(purchase, refs, {
      quantity: 100,
      lot_number: "LOTE-1",
    });
    await addLine(purchase, refs, {
      quantity: 200,
      lot_number: "LOTE-2",
      expiration_date: "2027-06-30",
    });
    const token = await tokenFor("seller");

    const response = await as(
      "post",
      `/purchases/${purchase.id}/confirm`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      lot_number: "LOTE-1",
      expiration_date: "2027-03-31",
      received_lot_id: expect.any(Number),
    });
    expect(response.body.items[1]).toMatchObject({
      lot_number: "LOTE-2",
      expiration_date: "2027-06-30",
      received_lot_id: expect.any(Number),
    });

    const lots = await Lot.findAll({
      where: { product_id: refs.product.id },
      order: [["id", "ASC"]],
    });
    expect(lots).toHaveLength(2);
    expect(lots.map((lot) => lot.location_status)).toEqual([
      "pending",
      "pending",
    ]);
    expect(lots.map((lot) => lot.stock)).toEqual([100, 200]);
    expect(lots.map((lot) => lot.reserved)).toEqual([0, 0]);
    expect(lots.map((lot) => lot.warehouse_id)).toEqual([null, null]);

    const stock = await Stock.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });
    expect(stock.quantity).toBe(300);
  });

  it("reuses a matching lot and increments its stock", async () => {
    const refs = await references();
    const first = await createPurchase({ supplier_id: refs.supplier.id });
    const second = await createPurchase({ supplier_id: refs.supplier.id });

    await addLine(first, refs, { quantity: 10, lot_number: "L-SHARED" });
    await addLine(second, refs, { quantity: 5, lot_number: "l-shared" });
    const token = await tokenFor("admin");

    await as("post", `/purchases/${first.id}/confirm`, token);
    const secondResponse = await as(
      "post",
      `/purchases/${second.id}/confirm`,
      token,
    );

    expect(secondResponse.status).toBe(200);

    const lots = await Lot.findAll({
      where: { product_id: refs.product.id },
    });
    expect(lots).toHaveLength(1);
    expect(lots[0].stock).toBe(15);
    expect(secondResponse.body.items[0].received_lot_id).toBe(lots[0].id);
  });

  it("rejects an incompatible existing lot and rolls the confirmation back", async () => {
    const refs = await references();
    const first = await createPurchase({ supplier_id: refs.supplier.id });
    const second = await createPurchase({ supplier_id: refs.supplier.id });

    await addLine(first, refs, {
      quantity: 10,
      lot_number: "L-CONFLICT",
      expiration_date: "2027-03-31",
    });
    await addLine(second, refs, {
      quantity: 5,
      lot_number: "L-CONFLICT",
      expiration_date: "2028-03-31",
    });
    const token = await tokenFor("admin");

    await as("post", `/purchases/${first.id}/confirm`, token);
    const response = await as("post", `/purchases/${second.id}/confirm`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Lot already exists with different data",
    });

    const stored = await Purchase.findByPk(second.id);
    expect(stored.status).toBe("draft");

    const lots = await Lot.findAll({
      where: { product_id: refs.product.id },
    });
    expect(lots).toHaveLength(1);
    expect(lots[0].stock).toBe(10);
  });
});

describe("purchase lot validation", () => {
  it("responds 422 when a draft line has no lot data", async () => {
    const refs = await references();
    const purchase = await createPurchase({ supplier_id: refs.supplier.id });

    await addLine(purchase, refs, {
      lot_number: null,
      expiration_date: null,
    });
    const token = await tokenFor("admin");

    const response = await as(
      "post",
      `/purchases/${purchase.id}/confirm`,
      token,
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        items: "Every item requires lot_number and expiration_date",
      },
    });
  });

  it("rejects the same product and lot twice even with another item state", async () => {
    const refs = await references();
    const otherState = await createItemState({
      name: `state_${Math.random().toString(36).slice(2, 8)}`,
      label: "Otro estado",
    });
    const token = await tokenFor("admin");

    const response = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      items: [
        {
          product_id: refs.product.id,
          item_state_id: refs.itemState.id,
          quantity: 1,
          unit_cost: 10,
          tax_amount: 0,
          lot_number: "L-DUP",
          expiration_date: "2027-03-31",
        },
        {
          product_id: refs.product.id,
          item_state_id: otherState.id,
          quantity: 2,
          unit_cost: 10,
          tax_amount: 0,
          lot_number: "l-dup",
          expiration_date: "2027-03-31",
        },
      ],
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item already exists" });
  });

  it("requires lot data when adding or updating a line", async () => {
    const refs = await references();
    const purchase = await createPurchase({ supplier_id: refs.supplier.id });
    const line = await addLine(purchase, refs, {
      lot_number: null,
      expiration_date: null,
    });
    const token = await tokenFor("admin");

    const missingOnCreate = await as(
      "post",
      `/purchases/${purchase.id}/items`,
      token,
    ).send({
      product_id: refs.product.id,
      item_state_id: refs.itemState.id,
      quantity: 1,
      unit_cost: 10,
      tax_amount: 0,
    });
    expect(missingOnCreate.status).toBe(400);

    const missingOnUpdate = await as(
      "put",
      `/purchases/${purchase.id}/items/${line.id}`,
      token,
    ).send({ quantity: 3 });
    expect(missingOnUpdate.status).toBe(400);
    expect(missingOnUpdate.body).toEqual({
      message: "lot_number and expiration_date are required",
    });
  });
});
