process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
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

describe("GET /currencies/:id/history with a real database", () => {
  it("returns the history descending with nested changed_by", async () => {
    const currency = await createCurrency({
      code: "USDT",
      rate: "1000.290000",
    });
    const token = await tokenFor("admin");
    const user = await User.findOne({ where: { username: "admin" } });
    await createHistory(currency.id, {
      new_rate: "1000.290000",
      changed_at: new Date("2026-10-29T12:00:00.000Z"),
    });

    await as("put", `/currencies/${currency.id}`, token).send({
      rate: 1005.75,
      reason: "Actualización diaria BCV",
    });

    const response = await as(
      "get",
      `/currencies/${currency.id}/history`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toEqual({
      id: expect.any(Number),
      currency_id: currency.id,
      previous_rate: 1000.29,
      new_rate: 1005.75,
      changed_by: {
        id: user.id,
        username: "admin",
        email: "admin@farmamad.com",
      },
      changed_at: expect.any(String),
      reason: "Actualización diaria BCV",
    });
    expect(response.body[1]).toEqual(
      expect.objectContaining({
        previous_rate: null,
        new_rate: 1000.29,
        changed_by: null,
        reason: "seed",
      }),
    );
    expect(new Date(response.body[0].changed_at).getTime()).toBeGreaterThan(
      new Date(response.body[1].changed_at).getTime(),
    );
  });

  it("keeps the history row when the user is deleted (SET NULL)", async () => {
    const currency = await createCurrency();
    const token = await tokenFor("admin");
    const user = await User.findOne({ where: { username: "admin" } });
    const history = await createHistory(currency.id, {
      changed_by: user.id,
      reason: "manual",
    });

    await user.destroy();

    const stored = await CurrencyRateHistory.findByPk(history.id);
    expect(stored).not.toBeNull();
    expect(stored.changed_by).toBeNull();
    expect(stored.reason).toBe("manual");
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/currencies/99999/history", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Currency not found" });

    const invalid = await as("get", "/currencies/abc/history", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid currency id" },
    });
  });

  it("responds 403 for the roles without read access", async () => {
    const currency = await createCurrency();
    const token = await tokenFor("support");

    const response = await as(
      "get",
      `/currencies/${currency.id}/history`,
      token,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
