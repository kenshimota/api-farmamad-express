process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
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

describe("POST /currencies with a real database", () => {
  it("creates the currency and its first history row", async () => {
    const token = await tokenFor("admin");
    const user = await User.findOne({ where: { username: "admin" } });

    const response = await as("post", "/currencies", token).send({
      code: "eur",
      name: "Euro",
      symbol: "€",
      rate: 970.5,
      is_base: true,
      is_active: false,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      code: "EUR",
      name: "Euro",
      symbol: "€",
      rate: 970.5,
      is_base: false,
      is_active: true,
      is_default_for_transactions: false,
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await Currency.findByPk(response.body.id);
    expect(stored.code).toBe("EUR");
    expect(stored.is_base).toBe(false);
    expect(stored.is_active).toBe(true);

    const history = await CurrencyRateHistory.findAll({
      where: { currency_id: response.body.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0].previous_rate).toBeNull();
    expect(Number(history[0].new_rate)).toBe(970.5);
    expect(history[0].changed_by).toBe(user.id);
    expect(history[0].reason).toBeNull();
  });

  it("responds 409 for a duplicated code ignoring case", async () => {
    await createCurrency({ code: "USDT" });
    const token = await tokenFor("admin");

    const response = await as("post", "/currencies", token).send({
      code: "usdt",
      name: "Tether",
      symbol: "$",
      rate: 1000.29,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Currency already exists" });
  });

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/currencies", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "code, name, symbol and rate are required",
    });

    const invalid = await as("post", "/currencies", token).send({
      code: "EUR",
      name: "Euro",
      symbol: "€",
      rate: 0,
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { rate: "rate must be greater than 0" },
    });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await request(app).post("/currencies").send({});
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await tokenFor("seller");
    const forbidden = await as("post", "/currencies", seller).send({
      code: "EUR",
      name: "Euro",
      symbol: "€",
      rate: 1,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("enforces the partial unique index for the base currency", async () => {
    await createCurrency({
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
      rate: "1.000000",
      is_base: true,
    });

    await expect(
      createCurrency({ code: "OTHER", is_base: true }),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("enforces the positive rate check and the DECIMAL(18,6) precision", async () => {
    await expect(
      Currency.create({
        code: "ZERO",
        name: "Zero",
        symbol: "Z",
        rate: "0.000000",
      }),
    ).rejects.toThrow();

    const stored = await Currency.create({
      code: "PRECISE",
      name: "Precise",
      symbol: "P",
      rate: "1000.123456",
    });

    expect(Number(stored.rate)).toBe(1000.123456);
  });

  it("prevents deleting a currency that still has history", async () => {
    const currency = await createCurrency();
    await createHistory(currency.id);

    await expect(currency.destroy()).rejects.toThrow(ForeignKeyConstraintError);
  });
});

describe("GET /currencies with a real database", () => {
  it("lists active currencies with the base first and then by code", async () => {
    const base = await createCurrency({
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
      rate: "1.000000",
      is_base: true,
    });
    const usdt = await createCurrency({
      code: "USDT",
      name: "Tether",
      symbol: "$",
      rate: "1000.290000",
    });
    const bcv = await createCurrency({
      code: "USD_BCV",
      name: "Dólar BCV",
      symbol: "$",
      rate: "889.890000",
    });
    const inactive = await createCurrency({
      code: "AAA",
      is_active: false,
    });
    const token = await tokenFor("manager_warehouse");

    const response = await as("get", "/currencies", token);

    expect(response.status).toBe(200);
    expect(response.body.map((row) => row.code)).toEqual([
      "VES",
      "USDT",
      "USD_BCV",
    ]);
    expect(response.body.map((row) => row.id)).toEqual([
      base.id,
      usdt.id,
      bcv.id,
    ]);
    expect(response.body.map((row) => row.id)).not.toContain(inactive.id);
  });

  it("includes inactive currencies only for an admin", async () => {
    await createCurrency({
      code: "VES",
      rate: "1.000000",
      is_base: true,
    });
    await createCurrency({ code: "ZZZ", is_active: false });
    const admin = await tokenFor("admin");

    const included = await as(
      "get",
      "/currencies?include_inactive=true",
      admin,
    );
    expect(included.status).toBe(200);
    expect(included.body.map((row) => row.code)).toEqual(["VES", "ZZZ"]);

    const seller = await tokenFor("seller");
    const forbidden = await as(
      "get",
      "/currencies?include_inactive=true",
      seller,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it.each(["admin", "seller", "manager_warehouse", "dispatcher"])(
    "allows a %s to read the list and the detail",
    async (role) => {
      const currency = await createCurrency({ code: "EUR" });
      const token = await tokenFor(role);

      const list = await as("get", "/currencies", token);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);

      const detail = await as("get", `/currencies/${currency.id}`, token);
      expect(detail.status).toBe(200);
      expect(detail.body).toEqual({
        id: currency.id,
        code: "EUR",
        name: "Euro",
        symbol: "€",
        rate: 970.5,
        is_base: false,
        is_active: true,
        is_default_for_transactions: false,
      });
    },
  );

  it.each(["support", "customer"])("responds 403 for a %s", async (role) => {
    const token = await tokenFor(role);

    const response = await as("get", "/currencies", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("returns an inactive currency by id", async () => {
    const currency = await createCurrency({ code: "OLD", is_active: false });
    const token = await tokenFor("admin");

    const response = await as("get", `/currencies/${currency.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body.is_active).toBe(false);
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/currencies/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Currency not found" });

    const invalid = await as("get", "/currencies/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid currency id" },
    });
  });
});
