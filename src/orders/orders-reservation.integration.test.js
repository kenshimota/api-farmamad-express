process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Cost = require("../models/cost");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  Order,
  OrderHistory,
  OrderItem,
  OrderItemLotAllocation,
  Stock,
  as,
  createCost,
  createItemState,
  createLot,
  createProduct,
  createSaleFixture,
  createStock,
  resetDatabase,
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

describe("POST /orders reservation with a real database", () => {
  it("reserves FEFO across lots and keeps stock unchanged", async () => {
    const fixture = await createSaleFixture();
    const oldest = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      {
        stock: 2,
        reserved: 1,
        expiration_date: "2026-01-31",
      },
    );
    const newest = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      {
        stock: 10,
        reserved: 0,
        expiration_date: "2027-12-31",
      },
    );
    await createStock(fixture.product, fixture.itemState, 12);

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 5,
        },
      ],
    });

    expect(response.status).toBe(201);
    await oldest.reload();
    await newest.reload();
    expect(oldest.reserved).toBe(2);
    expect(newest.reserved).toBe(4);
    expect(oldest.stock).toBe(2);
    expect(newest.stock).toBe(10);

    const allocations = await OrderItemLotAllocation.findAll({
      order: [["id", "ASC"]],
    });
    expect(
      allocations.map((allocation) => ({
        lot_id: allocation.lot_id,
        quantity: allocation.quantity,
        status: allocation.status,
      })),
    ).toEqual([
      { lot_id: oldest.id, quantity: 1, status: "reserved" },
      { lot_id: newest.id, quantity: 4, status: "reserved" },
    ]);

    const stock = await Stock.findOne({
      where: {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
      },
    });
    expect(stock.quantity).toBe(12);
  });

  it("rolls back the whole reservation when a later line lacks stock", async () => {
    const fixture = await createSaleFixture();
    const first = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      { stock: 10 },
    );
    const secondProduct = await createProduct();
    const secondState = await createItemState();
    await createCost(secondProduct, secondState, { cost: "5.00" });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 2,
        },
        {
          product_id: secondProduct.id,
          item_state_id: secondState.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Insufficient stock",
      items: [
        {
          product_id: secondProduct.id,
          item_state_id: secondState.id,
        },
      ],
    });
    await first.reload();
    expect(first.reserved).toBe(0);
    await expect(Order.count()).resolves.toBe(0);
    await expect(OrderItem.count()).resolves.toBe(0);
    await expect(OrderHistory.count()).resolves.toBe(0);
    await expect(OrderItemLotAllocation.count()).resolves.toBe(0);
  });

  it("allows only one of two concurrent orders for the last unit", async () => {
    const fixture = await createSaleFixture();
    const lot = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      { stock: 1, reserved: 0 },
    );
    const body = {
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 1,
        },
      ],
    };

    const [first, second] = await Promise.all([
      as("post", "/orders", fixture.token).send(body),
      as("post", "/orders", fixture.token).send(body),
    ]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([201, 409]);
    await lot.reload();
    expect(lot.reserved).toBe(1);
    await expect(Order.count()).resolves.toBe(1);
    await expect(OrderItemLotAllocation.count()).resolves.toBe(1);
  });

  it("keeps the price snapshot after the current cost changes", async () => {
    const fixture = await createSaleFixture();
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 5,
    });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 2,
        },
      ],
    });
    expect(response.status).toBe(201);

    await Cost.update(
      { cost: "99.00" },
      {
        where: {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
        },
      },
    );

    const item = await OrderItem.findOne({
      where: { order_id: response.body.id },
    });
    expect(item).toMatchObject({ unit_price: "14.29", subtotal: "28.58" });
  });
});
