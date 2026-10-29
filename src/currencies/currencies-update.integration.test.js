process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const User = require("../models/user");
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

describe("PUT /currencies/:id with a real database", () => {
  it("updates the rate and appends history atomically", async () => {
    const currency = await createCurrency({
      code: "USDT",
      rate: "1000.290000",
    });
    const token = await tokenFor("admin");
    const user = await User.findOne({ where: { username: "admin" } });

    const response = await as("put", `/currencies/${currency.id}`, token).send({
      rate: 1005.75,
      reason: "Actualización diaria BCV",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({ id: currency.id, rate: 1005.75 }),
    );

    const stored = await Currency.findByPk(currency.id);
    expect(Number(stored.rate)).toBe(1005.75);

    const history = await CurrencyRateHistory.findAll({
      where: { currency_id: currency.id },
    });
    expect(history).toHaveLength(1);
    expect(Number(history[0].previous_rate)).toBe(1000.29);
    expect(Number(history[0].new_rate)).toBe(1005.75);
    expect(history[0].changed_by).toBe(user.id);
    expect(history[0].reason).toBe("Actualización diaria BCV");
  });

  it("keeps six decimals in the rate and its history", async () => {
    const currency = await createCurrency({ rate: "1000.290000" });
    const token = await tokenFor("admin");

    const response = await as("put", `/currencies/${currency.id}`, token).send({
      rate: 1005.123456,
    });

    expect(response.status).toBe(202);
    expect(response.body.rate).toBe(1005.123456);

    const stored = await Currency.findByPk(currency.id);
    expect(Number(stored.rate)).toBe(1005.123456);

    const history = await CurrencyRateHistory.findOne({
      where: { currency_id: currency.id },
    });
    expect(Number(history.new_rate)).toBe(1005.123456);
  });

  it("does not append history when the rate does not change", async () => {
    const currency = await createCurrency({ rate: "1000.290000" });
    const token = await tokenFor("admin");

    const response = await as("put", `/currencies/${currency.id}`, token).send({
      rate: 1000.29,
      reason: "same",
    });

    expect(response.status).toBe(202);
    await expect(
      CurrencyRateHistory.count({ where: { currency_id: currency.id } }),
    ).resolves.toBe(0);
  });

  it("does not append history when only name or symbol change", async () => {
    const currency = await createCurrency();
    await createHistory(currency.id);
    const token = await tokenFor("admin");

    const response = await as("put", `/currencies/${currency.id}`, token).send({
      name: "Euro renovado",
      symbol: "EU",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({ name: "Euro renovado", symbol: "EU" }),
    );
    await expect(
      CurrencyRateHistory.count({ where: { currency_id: currency.id } }),
    ).resolves.toBe(1);
  });

  it("reactivates a deactivated currency", async () => {
    const currency = await createCurrency({ is_active: false });
    const token = await tokenFor("admin");

    const response = await as("put", `/currencies/${currency.id}`, token).send({
      is_active: true,
    });

    expect(response.status).toBe(202);
    expect(response.body.is_active).toBe(true);

    const stored = await Currency.findByPk(currency.id);
    expect(stored.is_active).toBe(true);
  });

  it("protects the base currency rate and status", async () => {
    const base = await createCurrency({
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
      rate: "1.000000",
      is_base: true,
    });
    const token = await tokenFor("admin");

    const rate = await as("put", `/currencies/${base.id}`, token).send({
      rate: 2,
    });
    expect(rate.status).toBe(409);
    expect(rate.body).toEqual({
      message: "Base currency rate cannot be changed",
    });

    const deactivate = await as("put", `/currencies/${base.id}`, token).send({
      is_active: false,
    });
    expect(deactivate.status).toBe(409);
    expect(deactivate.body).toEqual({
      message: "Base currency cannot be deactivated",
    });

    const untouched = await Currency.findByPk(base.id);
    expect(Number(untouched.rate)).toBe(1);
    expect(untouched.is_active).toBe(true);
    await expect(
      CurrencyRateHistory.count({ where: { currency_id: base.id } }),
    ).resolves.toBe(0);
  });

  it("responds 400, 401, 403, 404 and 422 for invalid requests", async () => {
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const empty = await as("put", `/currencies/${currency.id}`, token).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "At least one field is required",
    });

    const anonymous = await request(app)
      .put(`/currencies/${currency.id}`)
      .send({ rate: 2 });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await tokenFor("seller");
    const forbidden = await as(
      "put",
      `/currencies/${currency.id}`,
      seller,
    ).send({ rate: 2 });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });

    const missing = await as("put", "/currencies/99999", token).send({
      rate: 2,
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Currency not found" });

    const invalidId = await as("put", "/currencies/abc", token).send({
      rate: 2,
    });
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid currency id" },
    });

    const invalidRate = await as(
      "put",
      `/currencies/${currency.id}`,
      token,
    ).send({ rate: 0.0000001 });
    expect(invalidRate.status).toBe(422);
    expect(invalidRate.body).toEqual({
      errors: { rate: "rate must have at most 6 decimals" },
    });
  });
});

describe("default transaction currency protection", () => {
  it("rejects deactivating the default currency with PUT", async () => {
    const currency = await createCurrency({
      code: "USD_BCV",
      name: "Dólar BCV",
      symbol: "$",
      rate: "889.890000",
      is_default_for_transactions: true,
    });
    const token = await tokenFor("admin");

    const response = await as("put", `/currencies/${currency.id}`, token).send({
      is_active: false,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Default transaction currency cannot be deactivated",
    });
    const stored = await Currency.findByPk(currency.id);
    expect(stored.is_active).toBe(true);
  });
});
