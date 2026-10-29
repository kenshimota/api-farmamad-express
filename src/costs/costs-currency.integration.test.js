process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  ensureDefaultTransactionCurrency,
  publicCurrencySummary,
} = require("../../test/helpers/currency-default");
const {
  as,
  createCost,
  createItemState,
  createProduct,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/costs");

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
 * Creates a unique active currency for the test.
 * @returns {Promise<object>} The stored currency.
 */
function createCurrency() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return Currency.create({
    code: `CUR${suffix}`,
    name: "Moneda de prueba",
    symbol: "M",
    rate: "10.000000",
    is_base: false,
    is_active: true,
  });
}

describe("currency integration in costs", () => {
  it("stores the default currency when currency_id is omitted", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const currency = await ensureDefaultTransactionCurrency();
    const token = await tokenFor("admin");

    const response = await as("post", "/costs", token).send({
      product_id: product.id,
      item_state_id: itemState.id,
      cost: 12.5,
    });

    expect(response.status).toBe(201);
    expect(response.body.currency_id).toBe(currency.id);
    expect(response.body.currency).toEqual(publicCurrencySummary(currency));
  });

  it("accepts an explicit active currency and filters by currency_id", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const created = await as("post", "/costs", token).send({
      product_id: product.id,
      item_state_id: itemState.id,
      cost: 12.5,
      currency_id: currency.id,
    });
    expect(created.status).toBe(201);
    expect(created.body.currency).toEqual(publicCurrencySummary(currency));

    const list = await as("get", `/costs?currency_id=${currency.id}`, token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it("rejects a missing or inactive currency", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const token = await tokenFor("admin");
    const inactive = await Currency.create({
      code: `OLD${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      name: "Old",
      symbol: "O",
      rate: "1.000000",
      is_base: false,
      is_active: false,
    });

    for (const currencyId of [999999, inactive.id]) {
      const response = await as("post", "/costs", token).send({
        product_id: product.id,
        item_state_id: itemState.id,
        cost: 1,
        currency_id: currencyId,
      });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { currency_id: "Invalid currency" },
      });
    }
  });

  it("changes the currency of a cost without converting the amount", async () => {
    const cost = await createCost();
    const currency = await ensureDefaultTransactionCurrency();
    const token = await tokenFor("seller");

    const response = await as("put", `/costs/${cost.id}`, token).send({
      currency_id: currency.id,
    });

    expect(response.status).toBe(202);
    expect(response.body.cost).toBe(12.5);
    expect(response.body.currency_id).toBe(currency.id);
  });
});
