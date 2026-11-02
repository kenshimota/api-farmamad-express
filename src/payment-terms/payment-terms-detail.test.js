process.env.JWT_SECRET = "test-secret";

jest.mock("../models/payment-term", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/customer", () => ({ count: jest.fn() }));
jest.mock("../models/order", () => ({ count: jest.fn() }));
jest.mock("../models/invoice", () => ({ count: jest.fn() }));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const PaymentTerm = require("../models/payment-term");
const User = require("../models/user");
const paymentTermsRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/payment-terms", paymentTermsRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role to embed in the token.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored term double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The term double.
 */
function storedTerm(overrides = {}) {
  return {
    id: 4,
    code: "credit_30",
    name: "Crédito 30 días",
    description: null,
    days: 30,
    is_active: true,
    ...overrides,
  };
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function call(method, path, token = tokenFor()) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("GET /payment-terms/:id", () => {
  it("returns the term detail", async () => {
    PaymentTerm.findByPk.mockResolvedValue(storedTerm());

    const response = await call("get", "/payment-terms/4");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 4,
      code: "credit_30",
      name: "Crédito 30 días",
      description: null,
      days: 30,
      is_active: true,
    });
    expect(PaymentTerm.findByPk).toHaveBeenCalledWith(4);
  });

  it("responds 422 for an invalid id and 404 for a missing term", async () => {
    const invalid = await call("get", "/payment-terms/abc");
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid payment term id" },
    });

    PaymentTerm.findByPk.mockResolvedValue(null);
    const missing = await call("get", "/payment-terms/999");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Payment term not found" });
  });
});
