process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  createPaymentTerm,
  ensurePaymentTerm,
} = require("../../test/helpers/payment-terms");
const {
  Order,
  OrderHistory,
  OrderItem,
  OrderItemLotAllocation,
  Stock,
  as,
  createCost,
  createCurrency,
  createItemState,
  createLot,
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

describe("POST /orders creation with a real database", () => {
  it("creates the order, snapshots the price and reserves one lot", async () => {
    const fixture = await createSaleFixture();
    const lot = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      {
        stock: 10,
        reserved: 0,
      },
    );
    await createStock(fixture.product, fixture.itemState, 10);

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 2,
        },
      ],
      notes: "  Entregar por la tarde  ",
      customer_id: 999,
      user_id: 999,
      status: "delivered",
      number: 999,
      subtotal: 0,
      total: 0,
      currency_id: 999,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      number: expect.any(Number),
      status: "pending",
      customer_id: fixture.customer.id,
      user_id: fixture.user.id,
      currency_id: fixture.cost.currency_id,
      currency: {
        id: fixture.cost.currency_id,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      subtotal: 28.58,
      total: 28.58,
      payment_term_id: null,
      delivery_address: fixture.customer.direction,
      notes: "Entregar por la tarde",
      created_at: expect.any(String),
      customer: {
        id: fixture.customer.id,
        fullName: fixture.customer.fullName,
        email: fixture.customer.email,
        direction: fixture.customer.direction,
      },
      items: [
        {
          id: expect.any(Number),
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          item_state: {
            id: fixture.itemState.id,
            name: fixture.itemState.name,
            label: fixture.itemState.label,
          },
          quantity: 2,
          unit_price: 14.29,
          subtotal: 28.58,
          product: {
            id: fixture.product.id,
            name: fixture.product.name,
            reference: fixture.product.reference,
            image_id: fixture.product.image_id,
          },
        },
      ],
      history: [
        {
          event_type: "created",
          from_status: null,
          to_status: "pending",
          created_at: expect.any(String),
        },
      ],
    });
    expect(response.body.items[0]).not.toHaveProperty("allocations");
    expect(response.body.items[0]).not.toHaveProperty("lot_id");
    expect(response.body.items[0]).not.toHaveProperty("cost");

    const stored = await Order.findByPk(response.body.id);
    expect(stored).toMatchObject({
      number: response.body.number,
      status: "pending",
      customer_id: fixture.customer.id,
      user_id: fixture.user.id,
      subtotal: "28.58",
      total: "28.58",
    });
    await lot.reload();
    expect(lot.reserved).toBe(2);
    expect(lot.stock).toBe(10);
    const allocation = await OrderItemLotAllocation.findOne({
      where: { lot_id: lot.id },
    });
    expect(allocation).toMatchObject({ quantity: 2, status: "reserved" });
    const stock = await Stock.findOne({
      where: {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
      },
    });
    expect(stock.quantity).toBe(10);
    await expect(OrderHistory.count()).resolves.toBe(1);
  });

  it("allows two lines of the same product in different item states", async () => {
    const fixture = await createSaleFixture();
    const secondState = await createItemState();
    await createCost(fixture.product, secondState, { cost: "20.00" });
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 5,
      expiration_date: "2027-01-31",
    });
    await createLot(fixture.product, secondState, fixture.location, {
      stock: 5,
      expiration_date: "2027-02-28",
    });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 1,
        },
        {
          product_id: fixture.product.id,
          item_state_id: secondState.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        item_state_id: fixture.itemState.id,
        unit_price: 14.29,
        subtotal: 14.29,
      }),
      expect.objectContaining({
        item_state_id: secondState.id,
        unit_price: 28.57,
        subtotal: 28.57,
      }),
    ]);
    expect(response.body.subtotal).toBe(42.86);
    await expect(OrderItem.count()).resolves.toBe(2);
  });

  it("converts the cost currency into the default transaction currency", async () => {
    const costCurrency = await createCurrency({ rate: "1779.780000" });
    const fixture = await createSaleFixture({
      cost: { cost: "10.00", currency: costCurrency },
    });
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 5,
    });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.currency.code).toBe("USD_BCV");
    expect(response.body.items[0].unit_price).toBe(28.57);
  });

  it("assigns ascending server-side numbers", async () => {
    const fixture = await createSaleFixture();
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 10,
    });
    const body = {
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 1,
        },
      ],
    };

    const first = await as("post", "/orders", fixture.token).send(body);
    const second = await as("post", "/orders", fixture.token).send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.number).toBe(first.body.number + 1);
  });
});
