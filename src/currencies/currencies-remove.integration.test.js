process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCurrency,
  createHistory,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/currencies");

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

describe("DELETE /currencies/:id with a real database", () => {
  it("deactivates the currency and keeps its history", async () => {
    const currency = await createCurrency();
    await createHistory(currency.id);
    const token = await tokenFor("admin");

    const response = await as("delete", `/currencies/${currency.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");

    const stored = await Currency.findByPk(currency.id);
    expect(stored).not.toBeNull();
    expect(stored.is_active).toBe(false);
    await expect(
      CurrencyRateHistory.count({ where: { currency_id: currency.id } }),
    ).resolves.toBe(1);

    const again = await as("delete", `/currencies/${currency.id}`, token);
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ message: "Currency not found" });
  });

  it("responds 409 for the base currency", async () => {
    const currency = await createCurrency({
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
      rate: "1.000000",
      is_base: true,
    });
    const token = await tokenFor("admin");

    const response = await as("delete", `/currencies/${currency.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Base currency cannot be deactivated",
    });

    const stored = await Currency.findByPk(currency.id);
    expect(stored.is_active).toBe(true);
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const currency = await createCurrency();

    const anonymous = await request(app).delete(`/currencies/${currency.id}`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await tokenFor("seller");
    const forbidden = await as("delete", `/currencies/${currency.id}`, seller);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
