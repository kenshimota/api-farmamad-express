process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  Order,
  OrderHistory,
  OrderItem,
  OrderItemLotAllocation,
  as,
  createCost,
  createCurrency,
  createCustomer,
  createItemState,
  createLot,
  createPriceList,
  createSaleFixture,
  ensureDefaultTransactionCurrency,
  resetDatabase,
  sessionFor,
} = require("../../test/helpers/orders");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

/**
 * Builds the request body for one line.
 * @param {object} fixture - Sale fixture.
 * @param {number} [quantity] - Requested quantity.
 * @returns {object} The request body.
 */
function bodyFor(fixture, quantity = 1) {
  return {
    items: [
      {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
        quantity,
      },
    ],
  };
}

describe("POST /orders authorization and validation errors", () => {
  it("responds 401 without a token and 403 for an internal role", async () => {
    const anonymous = await request(app).post("/orders").send({ items: [] });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await sessionFor("seller");
    const forbidden = await as("post", "/orders", seller.token).send({
      items: [{ product_id: 1, item_state_id: 1, quantity: 1 }],
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("responds 400 when items is missing", async () => {
    const fixture = await createSaleFixture();
    const response = await as("post", "/orders", fixture.token).send({
      notes: "sin líneas",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "items is required" });
  });

  it("responds 403 when the customer profile is not linked", async () => {
    const session = await sessionFor("customer");

    const response = await as("post", "/orders", session.token).send({
      items: [{ product_id: 1, item_state_id: 1, quantity: 1 }],
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });

  it("responds 403 when the customer has no price list", async () => {
    const customer = await createCustomer({ price_list_id: null });
    const session = await sessionFor("customer", { customer_id: customer.id });

    const response = await as("post", "/orders", session.token).send({
      items: [{ product_id: 1, item_state_id: 1, quantity: 1 }],
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer price list is not assigned",
    });
  });

  it("responds 503 without an active default transaction currency", async () => {
    const priceList = await createPriceList();
    const customer = await createCustomer({ price_list_id: priceList.id });
    const session = await sessionFor("customer", { customer_id: customer.id });
    await Currency.update(
      { is_default_for_transactions: false },
      { where: { is_default_for_transactions: true } },
    );

    const response = await as("post", "/orders", session.token).send({
      items: [{ product_id: 1, item_state_id: 1, quantity: 1 }],
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: "Default transaction currency is not configured",
    });

    await ensureDefaultTransactionCurrency();
  });

  it("responds 422 for an invalid or non-sellable item state", async () => {
    const fixture = await createSaleFixture();
    const blocked = await createItemState({ is_sellable: false });

    const missing = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: 999999,
          quantity: 1,
        },
      ],
    });
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { items: "Invalid item state 999999" },
    });

    const notSellable = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: blocked.id,
          quantity: 1,
        },
      ],
    });
    expect(notSellable.status).toBe(422);
    expect(notSellable.body).toEqual({
      errors: { items: `Invalid item state ${blocked.id}` },
    });
  });

  it("responds 422 when the product has no cost", async () => {
    const fixture = await createSaleFixture();
    const otherState = await createItemState();

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: otherState.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        items: `Product ${fixture.product.id} is not available for sale`,
      },
    });
  });

  it("responds 422 for duplicated product/state pairs", async () => {
    const fixture = await createSaleFixture();
    const line = bodyFor(fixture).items[0];

    const response = await as("post", "/orders", fixture.token).send({
      items: [line, line],
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        items: `Duplicate product ${fixture.product.id} and item state ${fixture.itemState.id}`,
      },
    });
    await expect(Order.count()).resolves.toBe(0);
  });

  it("responds 409 without writing anything when stock is insufficient", async () => {
    const fixture = await createSaleFixture();
    const lot = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      { stock: 1, reserved: 0 },
    );

    const response = await as("post", "/orders", fixture.token).send(
      bodyFor(fixture, 2),
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Insufficient stock",
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
        },
      ],
    });
    await expect(Order.count()).resolves.toBe(0);
    await expect(OrderItem.count()).resolves.toBe(0);
    await expect(OrderHistory.count()).resolves.toBe(0);
    await expect(OrderItemLotAllocation.count()).resolves.toBe(0);
    await lot.reload();
    expect(lot.reserved).toBe(0);
  });

  it("rejects a non-sellable cost currency as unavailable", async () => {
    const costCurrency = await createCurrency({ rate: "2.000000" });
    const fixture = await createSaleFixture({
      cost: { cost: "5.00", currency: costCurrency },
    });
    const inactive = await createItemState();
    await createCost(fixture.product, inactive, {
      cost: "5.00",
      currency: costCurrency,
    });
    await createLot(fixture.product, inactive, fixture.location, {
      stock: 10,
    });
    await costCurrency.update({ is_active: false });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: inactive.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.errors.items).toContain("is not available for sale");
  });
});
