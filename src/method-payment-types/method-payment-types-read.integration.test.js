process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCurrency,
  createMethodPaymentType,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/method-payment-types");

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

describe("GET /method-payment-types with a real database", () => {
  it("lists types ordered by code, filters and nests the currency", async () => {
    const first = await createCurrency();
    const second = await createCurrency();
    const paypal = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: first.id,
      fields: [],
    });
    const bank = await createMethodPaymentType({
      code: "BANK",
      currency_id: first.id,
      fields: [],
    });
    const binance = await createMethodPaymentType({
      code: "BINANCE",
      currency_id: second.id,
      fields: [],
      is_active: false,
    });
    const token = await tokenFor("dispatcher");

    const all = await as("get", "/method-payment-types", token);
    expect(all.status).toBe(200);
    expect(all.body.map((row) => row.code)).toEqual([
      "BANK",
      "BINANCE",
      "PAYPAL",
    ]);
    expect(all.body.map((row) => row.currency.code)).toEqual([
      first.code,
      second.code,
      first.code,
    ]);

    const byCurrency = await as(
      "get",
      `/method-payment-types?currency_id=${first.id}`,
      token,
    );
    expect(byCurrency.body.map((row) => row.id)).toEqual([bank.id, paypal.id]);

    const inactive = await as(
      "get",
      "/method-payment-types?is_active=false",
      token,
    );
    expect(inactive.body.map((row) => row.id)).toEqual([binance.id]);

    const active = await as(
      "get",
      "/method-payment-types?is_active=true",
      token,
    );
    expect(active.body.map((row) => row.id)).toEqual([bank.id, paypal.id]);
  });

  it("returns the detail and validates ids and filters", async () => {
    const currency = await createCurrency();
    const type = await createMethodPaymentType({
      code: "PAYPAL",
      currency_id: currency.id,
    });
    const token = await tokenFor("seller");

    const detail = await as("get", `/method-payment-types/${type.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body.code).toBe("PAYPAL");
    expect(detail.body.currency).toEqual({
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    });

    const missing = await as("get", "/method-payment-types/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Payment type not found" });

    const invalidId = await as("get", "/method-payment-types/abc", token);
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid payment type id" },
    });

    const invalidFilter = await as(
      "get",
      "/method-payment-types?is_active=maybe",
      token,
    );
    expect(invalidFilter.status).toBe(422);
    expect(invalidFilter.body).toEqual({
      errors: { is_active: "Invalid is_active" },
    });

    const invalidCurrency = await as(
      "get",
      "/method-payment-types?currency_id=abc",
      token,
    );
    expect(invalidCurrency.status).toBe(422);
    expect(invalidCurrency.body).toEqual({
      errors: { currency_id: "Invalid currency_id" },
    });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const anonymous = await request(app).get("/method-payment-types");
    expect(anonymous.status).toBe(401);

    const manager = await tokenFor("manager_warehouse");
    const forbidden = await as("get", "/method-payment-types", manager);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
