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

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Currency = require("../models/currency");
const User = require("../models/user");
const removeRouter = require("./remove");

const app = express();
app.use(express.json());
app.use("/currencies", removeRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
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
 * Sends a DELETE /currencies/:id request.
 * @param {string} id - Route parameter.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function remove(id, token = tokenFor()) {
  const req = request(app).delete(`/currencies/${id}`);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findByPk.mockResolvedValue(target());
});

describe("DELETE /currencies/:id", () => {
  it("allows an admin to deactivate a currency and answers 204", async () => {
    const stored = target();
    Currency.findByPk.mockResolvedValue(stored);

    const response = await remove("2");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(stored.update).toHaveBeenCalledWith(
      { is_active: false },
      { transaction: undefined },
    );
  });

  it("responds 409 when the base currency is deactivated", async () => {
    const stored = target({
      code: "VES",
      rate: "1.000000",
      is_base: true,
    });
    Currency.findByPk.mockResolvedValue(stored);

    const response = await remove("1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Base currency cannot be deactivated",
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it("responds 409 when the default transaction currency is deactivated", async () => {
    const stored = target({
      code: "USD_BCV",
      is_default_for_transactions: true,
    });
    Currency.findByPk.mockResolvedValue(stored);

    const response = await remove("3");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Default transaction currency cannot be deactivated",
    });
    expect(stored.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the currency does not exist", async () => {
    Currency.findByPk.mockResolvedValue(null);

    const response = await remove("999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Currency not found" });
  });

  it("responds 404 when the currency is already inactive", async () => {
    Currency.findByPk.mockResolvedValue(target({ is_active: false }));

    const response = await remove("2");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Currency not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await remove(id);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid currency id" },
      });
      expect(Currency.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 when the token is missing", async () => {
    const response = await remove("2", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Currency.findByPk).not.toHaveBeenCalled();
  });

  it.each(["seller", "manager_warehouse", "dispatcher", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await remove("2", tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Currency.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await remove("2");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });

  it("forwards unexpected persistence errors", async () => {
    const stored = target();
    stored.update.mockRejectedValue(new Error("database exploded"));
    Currency.findByPk.mockResolvedValue(stored);

    const response = await remove("2");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
