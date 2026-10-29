process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Purchase = require("../models/purchase");
const Cost = require("../models/cost");
const Stock = require("../models/stock");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
const {
  as,
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
  ensureDefaultTransactionCurrency,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/purchases");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

/**
 * Builds the references needed by a confirmation.
 * @returns {Promise<object>} Supplier, product and item state.
 */
async function references() {
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    supplier: await createPurchaseSupplier(),
    product: await createProduct({ reference: `CONFIRM-${suffix}` }),
    itemState: await createItemState({
      name: `state_${suffix}`,
      label: `Estado ${suffix}`,
      is_sellable: true,
    }),
  };
}

/**
 * Adds one line to a purchase.
 * @param {object} purchase - Purchase instance.
 * @param {object} refs - References.
 * @param {number} quantity - Quantity to add.
 * @param {number} unitCost - Unit cost.
 * @returns {Promise<object>} The created line.
 */
function addLine(purchase, refs, quantity, unitCost) {
  return createPurchaseItem({
    purchase_id: purchase.id,
    product_id: refs.product.id,
    item_state_id: refs.itemState.id,
    quantity,
    unit_cost: unitCost,
    subtotal: quantity * unitCost,
  });
}

describe("POST /purchases/:id/confirm with a real database", () => {
  it("confirms atomically and updates costs and stocks", async () => {
    const refs = await references();
    const purchase = await createPurchase({ supplier_id: refs.supplier.id });
    await addLine(purchase, refs, 40, 20);
    const token = await tokenFor("seller");

    const response = await as(
      "post",
      `/purchases/${purchase.id}/confirm`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: purchase.id,
        status: "confirmed",
        subtotal: 800,
        tax_amount: 128,
        total: 928,
        confirmed_at: expect.any(String),
        supplier: expect.objectContaining({ id: refs.supplier.id }),
      }),
    );
    expect(response.body.items).toHaveLength(1);
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await Purchase.findByPk(purchase.id);
    expect(stored.status).toBe("confirmed");
    expect(stored.confirmed_at).toBeInstanceOf(Date);

    const cost = await Cost.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });
    expect(Number(cost.cost)).toBe(20);

    const stock = await Stock.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });
    expect(stock.quantity).toBe(40);
  });

  it("lets the latest confirmed purchase win the current cost and accumulates stock", async () => {
    const refs = await references();
    const first = await createPurchase({ supplier_id: refs.supplier.id });
    const second = await createPurchase({ supplier_id: refs.supplier.id });
    await addLine(first, refs, 2, 10);
    await addLine(second, refs, 3, 12.5);
    const token = await tokenFor("admin");

    await as("post", `/purchases/${first.id}/confirm`, token);
    await as("post", `/purchases/${second.id}/confirm`, token);

    const cost = await Cost.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });
    const stock = await Stock.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });

    expect(Number(cost.cost)).toBe(12.5);
    expect(stock.quantity).toBe(5);
  });

  it("updates an existing cost and increments an existing stock", async () => {
    const refs = await references();
    await Cost.create({
      product_id: refs.product.id,
      item_state_id: refs.itemState.id,
      cost: 5,
      currency_id: (await ensureDefaultTransactionCurrency()).id,
    });
    await Stock.create({
      product_id: refs.product.id,
      item_state_id: refs.itemState.id,
      quantity: 10,
    });
    const purchase = await createPurchase({ supplier_id: refs.supplier.id });
    await addLine(purchase, refs, 4, 25);
    const token = await tokenFor("seller");

    const response = await as(
      "post",
      `/purchases/${purchase.id}/confirm`,
      token,
    );

    expect(response.status).toBe(200);
    const cost = await Cost.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });
    const stock = await Stock.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.itemState.id,
      },
    });
    expect(Number(cost.cost)).toBe(25);
    expect(stock.quantity).toBe(14);
  });

  it("responds 422 without lines and 409 when confirmed twice or cancelled", async () => {
    const empty = await createPurchase();
    const token = await tokenFor("admin");

    const noItems = await as("post", `/purchases/${empty.id}/confirm`, token);
    expect(noItems.status).toBe(422);
    expect(noItems.body).toEqual({ message: "Purchase has no items" });

    const refs = await references();
    const purchase = await createPurchase({ supplier_id: refs.supplier.id });
    await addLine(purchase, refs, 1, 1);
    const first = await as("post", `/purchases/${purchase.id}/confirm`, token);
    expect(first.status).toBe(200);

    const again = await as("post", `/purchases/${purchase.id}/confirm`, token);
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ message: "Purchase already confirmed" });

    const cancelled = await createPurchase({ status: "cancelled" });
    const cancelledResponse = await as(
      "post",
      `/purchases/${cancelled.id}/confirm`,
      token,
    );
    expect(cancelledResponse.status).toBe(409);
    expect(cancelledResponse.body).toEqual({
      message: "Purchase is not editable",
    });
  });

  it("responds 404, 401 and 403", async () => {
    const token = await tokenFor("admin");
    const missing = await as("post", "/purchases/99999/confirm", token);
    expect(missing.status).toBe(404);

    const anonymous = await require("supertest")(require("../app")).post(
      "/purchases/1/confirm",
    );
    expect(anonymous.status).toBe(401);

    const manager = await tokenFor("manager_warehouse");
    const purchase = await createPurchase();
    const forbidden = await as(
      "post",
      `/purchases/${purchase.id}/confirm`,
      manager,
    );
    expect(forbidden.status).toBe(403);
  });
});
