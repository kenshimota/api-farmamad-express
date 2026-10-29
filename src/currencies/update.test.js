process.env.JWT_SECRET = "test-secret";

jest.mock("../models/currency", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/currency-rate-history", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const db = require("../database");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const User = require("../models/user");
const updateRouter = require("./update");

const app = express();
app.use(express.json());
app.use("/currencies", updateRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const CURRENCY = {
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
  rate: "1000.290000",
  is_base: false,
  is_active: true,
};

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role name to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored currency double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored currency double.
 */
function target(overrides = {}) {
  return {
    ...CURRENCY,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

/**
 * Sends a PUT /currencies/:id request.
 * @param {string} id - Route parameter.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/currencies/${id}`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  db.transaction.mockImplementation((callback) => callback(TRANSACTION));
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findByPk.mockResolvedValue(target());
  CurrencyRateHistory.create.mockImplementation(async (values) => ({
    id: 5,
    ...values,
  }));
});

describe("PUT /currencies/:id", () => {
  it("allows an admin to update the rate and answers 202", async () => {
    const response = await put("2", {
      rate: 1005.75,
      reason: "Actualización diaria BCV",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: 2,
      code: "USDT",
      name: "Tether",
      symbol: "$",
      rate: 1005.75,
      is_base: false,
      is_active: true,
      is_default_for_transactions: false,
    });
    expect(CurrencyRateHistory.create).toHaveBeenCalledWith(
      {
        currency_id: 2,
        previous_rate: 1000.29,
        new_rate: 1005.75,
        changed_by: 1,
        reason: "Actualización diaria BCV",
      },
      { transaction: TRANSACTION },
    );
  });

  it("updates name, symbol and is_active without history when rate does not change", async () => {
    const response = await put("2", {
      name: "Tether USD",
      symbol: "USDT",
      rate: 1000.29,
      is_active: true,
      reason: "ignored",
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        name: "Tether USD",
        symbol: "USDT",
        rate: 1000.29,
      }),
    );
    expect(CurrencyRateHistory.create).not.toHaveBeenCalled();
  });

  it("reactivates an inactive currency with is_active=true", async () => {
    Currency.findByPk.mockResolvedValue(target({ is_active: false }));

    const response = await put("2", { is_active: true });

    expect(response.status).toBe(202);
    expect(response.body.is_active).toBe(true);
    expect(CurrencyRateHistory.create).not.toHaveBeenCalled();
  });

  it("ignores code and is_base because they are immutable", async () => {
    const stored = target();
    Currency.findByPk.mockResolvedValue(stored);

    const response = await put("2", { code: "EUR", is_base: true, rate: 2 });

    expect(response.status).toBe(202);
    expect(stored.update).toHaveBeenCalledWith(
      { rate: 2 },
      { transaction: TRANSACTION },
    );
    expect(response.body.code).toBe("USDT");
    expect(response.body.is_base).toBe(false);
  });

  it("responds 409 when the base currency rate changes", async () => {
    Currency.findByPk.mockResolvedValue(
      target({ code: "VES", rate: "1.000000", is_base: true }),
    );

    const response = await put("1", { rate: 2 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Base currency rate cannot be changed",
    });
    expect(CurrencyRateHistory.create).not.toHaveBeenCalled();
  });

  it("allows the base currency to keep rate 1", async () => {
    Currency.findByPk.mockResolvedValue(
      target({ code: "VES", rate: "1.000000", is_base: true }),
    );

    const response = await put("1", { rate: 1, name: "Bolívar" });

    expect(response.status).toBe(202);
    expect(response.body.rate).toBe(1);
    expect(CurrencyRateHistory.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the base currency is deactivated", async () => {
    Currency.findByPk.mockResolvedValue(
      target({ code: "VES", rate: "1.000000", is_base: true }),
    );

    const response = await put("1", { is_active: false });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Base currency cannot be deactivated",
    });
  });

  it("responds 400 when no field is provided", async () => {
    const response = await put("2", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
    expect(Currency.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ rate: 0 }, { rate: "rate must be greater than 0" }],
    [{ rate: -1 }, { rate: "rate must be greater than 0" }],
    [{ rate: 0.0000001 }, { rate: "rate must have at most 6 decimals" }],
    [{ rate: 1000000000000 }, { rate: "rate must be at most 999999999999" }],
    [{ is_active: "true" }, { is_active: "is_active must be a boolean" }],
    [
      { reason: "x".repeat(256) },
      { reason: "reason must have at most 255 characters" },
    ],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await put("2", body);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Currency.findByPk).not.toHaveBeenCalled();
  });

  it("responds 404 when the currency does not exist", async () => {
    Currency.findByPk.mockResolvedValue(null);

    const response = await put("999", { rate: 2 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Currency not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await put(id, { rate: 2 });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid currency id" },
      });
      expect(Currency.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await put("2", { rate: 2 }, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Currency.findByPk).not.toHaveBeenCalled();
  });

  it.each(["seller", "manager_warehouse", "dispatcher", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await put("2", { rate: 2 }, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Currency.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await put("2", { rate: 2 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const stored = target();
    stored.update.mockRejectedValue(new Error("database exploded"));
    Currency.findByPk.mockResolvedValue(stored);

    const response = await put("2", { rate: 1005.75 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
