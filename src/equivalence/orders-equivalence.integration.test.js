process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createOrderFixture } = require("../../test/helpers/order-lifecycle");
const {
  as,
  resetDatabase,
  sessionFor,
  linkedCustomerSession,
} = require("../../test/helpers/orders");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
  await ensureBaseCurrency();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

/**
 * Ensures the seeded VES base currency exists after a suite truncated it.
 * @returns {Promise<object>} The base currency.
 */
async function ensureBaseCurrency() {
  const base = await Currency.findOne({ where: { is_base: true } });

  if (base) {
    return base.update({ is_active: true, rate: "1.000000" });
  }

  const ves = await Currency.findOne({ where: { code: "VES" } });

  if (ves) {
    return ves.update({ is_base: true, is_active: true, rate: "1.000000" });
  }

  return Currency.create({
    code: "VES",
    name: "Bolívar",
    symbol: "Bs",
    rate: "1.000000",
    is_base: true,
    is_active: true,
  });
}

/**
 * Creates one order with a single line.
 * @param {object} fixture - Order fixture.
 * @param {string} token - Customer token.
 * @returns {Promise<import("supertest").Response>} Created order response.
 */
function createOrder(fixture, token) {
  return as("post", "/orders", token).send({
    items: [
      {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
        quantity: 2,
      },
    ],
  });
}

describe("GET /orders/:id/equivalence with a real database", () => {
  it("converts the order to the base currency by default", async () => {
    const fixture = await createOrderFixture({ stock: 5, term: "credit_10" });
    const created = await createOrder(fixture, fixture.token);
    expect(created.status).toBe(201);

    const response = await as(
      "get",
      `/orders/${created.body.id}/equivalence`,
      fixture.token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource: "order",
      order: {
        id: created.body.id,
        number: created.body.number,
        status: "draft",
        customer_id: fixture.customer.id,
      },
      payment_term: { code: "credit_10", days: 10 },
      source: {
        currency: { code: "USD_BCV", is_base: false },
        subtotal: 28.58,
        total: 28.58,
      },
      target: { currency: { code: "VES", is_base: true }, subtotal: 25433.06 },
      exchange_rate: 889.89,
      rate_source: "currencies.rate",
      payment: { is_cash: false, amount_due_source: 28.58 },
      calculated_at: expect.any(String),
    });
    expect(response.body.payment.amount_due_target).toBe(25433.06);
    for (const value of Object.values(response.body.rates_updated_at)) {
      expect(value === null || typeof value === "string").toBe(true);
    }
    expect(response.body.lines).toEqual([
      expect.objectContaining({
        product_id: fixture.product.id,
        item_state_name: fixture.itemState.label,
        quantity: 2,
        unit_price_source: 14.29,
        subtotal_source: 28.58,
      }),
    ]);
  });

  it("returns rate 1 for the source currency and does not modify the order", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const created = await createOrder(fixture, fixture.token);
    const before = await as("get", `/orders/${created.body.id}`, fixture.token);

    const response = await as(
      "get",
      `/orders/${created.body.id}/equivalence?currency_id=${created.body.currency_id}`,
      fixture.token,
    );

    expect(response.status).toBe(200);
    expect(response.body.exchange_rate).toBe(1);
    expect(response.body.target.total).toBe(response.body.source.total);
    expect(response.body.rounding_adjustment).toBe(0);

    const after = await as("get", `/orders/${created.body.id}`, fixture.token);
    expect(after.body).toEqual(before.body);
  });

  it("hides another customer's order and rejects warehouse roles", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const created = await createOrder(fixture, fixture.token);
    const other = await linkedCustomerSession();
    const dispatcher = await sessionFor("dispatcher");

    const foreign = await as(
      "get",
      `/orders/${created.body.id}/equivalence`,
      other.token,
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ message: "Order not found" });

    const forbidden = await as(
      "get",
      `/orders/${created.body.id}/equivalence`,
      dispatcher.token,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("validates the target currency", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const created = await createOrder(fixture, fixture.token);
    const inactive = await Currency.create({
      code: `O${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      name: "Test off",
      symbol: "T",
      rate: "2.000000",
      is_base: false,
      is_active: false,
    });
    const path = `/orders/${created.body.id}/equivalence`;

    const missing = await as("get", `${path}?currency_id=99999`, fixture.token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Currency not found" });

    const disabled = await as(
      "get",
      `${path}?currency_id=${inactive.id}`,
      fixture.token,
    );
    expect(disabled.status).toBe(422);
    expect(disabled.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });

    const invalid = await as("get", `${path}?currency_id=abc`, fixture.token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { currency_id: "Invalid currency_id" },
    });
  });
});
