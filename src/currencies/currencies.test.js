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
const { UniqueConstraintError } = require("sequelize");
const db = require("../database");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const User = require("../models/user");
const currenciesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/currencies", currenciesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const BODY = { code: "EUR", name: "Euro", symbol: "€", rate: 970.5 };

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
 * Sends a POST /currencies request.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body, token = tokenFor()) {
  const req = request(app).post("/currencies");

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  db.transaction.mockImplementation((callback) => callback(TRANSACTION));
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.create.mockImplementation(async (values) => ({
    id: 4,
    ...values,
    rate: "970.500000",
  }));
  CurrencyRateHistory.create.mockImplementation(async (values) => ({
    id: 1,
    ...values,
  }));
});

describe("POST /currencies", () => {
  it("allows an admin to create a currency and answers 201", async () => {
    const response = await post(BODY);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 4,
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
    expect(Currency.create).toHaveBeenCalledWith(
      {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        rate: 970.5,
        is_base: false,
        is_active: true,
      },
      { transaction: TRANSACTION },
    );
  });

  it("normalizes the code and inserts the first history row", async () => {
    const response = await post({ ...BODY, code: "  eur  " });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe("EUR");
    expect(CurrencyRateHistory.create).toHaveBeenCalledWith(
      {
        currency_id: 4,
        previous_rate: null,
        new_rate: "970.500000",
        changed_by: 1,
        reason: null,
      },
      { transaction: TRANSACTION },
    );
  });

  it("ignores is_base and is_active sent by the client", async () => {
    const response = await post({ ...BODY, is_base: true, is_active: false });

    expect(response.status).toBe(201);
    expect(Currency.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_base: false, is_active: true }),
      { transaction: TRANSACTION },
    );
  });

  it("drops unknown and audit fields", async () => {
    const response = await post({
      ...BODY,
      id: 99,
      createdAt: "2026-10-29",
      updatedAt: "2026-10-29",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(Currency.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EUR" }),
      { transaction: TRANSACTION },
    );
    expect(Currency.create.mock.calls[0][0]).not.toHaveProperty("id");
  });

  it("responds 409 when the code already exists", async () => {
    const error = new UniqueConstraintError({ message: "duplicate" });
    Currency.create.mockRejectedValue(error);

    const response = await post(BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Currency already exists" });
  });

  it.each([
    [{}, "code, name, symbol and rate are required"],
    [{ code: "EUR" }, "code, name, symbol and rate are required"],
    [
      { code: "EUR", name: "Euro", symbol: "€" },
      "code, name, symbol and rate are required",
    ],
  ])("responds 400 when a required field is missing in %p", async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "code, name, symbol and rate are required",
    });
    expect(Currency.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...BODY, code: "A" }, { code: "code must match ^[A-Z0-9_]{2,10}$" }],
    [
      { ...BODY, name: "E" },
      { name: "name must be between 2 and 100 characters" },
    ],
    [
      { ...BODY, symbol: "   " },
      { symbol: "symbol must be between 1 and 10 characters" },
    ],
    [{ ...BODY, rate: 0 }, { rate: "rate must be greater than 0" }],
    [
      { ...BODY, rate: 0.0000001 },
      { rate: "rate must have at most 6 decimals" },
    ],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(Currency.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await post(BODY, null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
    expect(Currency.create).not.toHaveBeenCalled();
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await post(BODY, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["seller", "manager_warehouse", "dispatcher", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await post(BODY, tokenFor(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
      expect(Currency.create).not.toHaveBeenCalled();
    },
  );

  it("responds 403 when the authenticated user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await post(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
    expect(Currency.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    Currency.create.mockRejectedValue(new Error("database exploded"));

    const response = await post(BODY);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
  });
});
