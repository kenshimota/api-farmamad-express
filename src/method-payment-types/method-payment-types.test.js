process.env.JWT_SECRET = "test-secret";

jest.mock("../models/method-payment-type", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/currency", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock(
  "../models/method-payment",
  () => ({
    count: jest.fn(),
    getAttributes: jest.fn(() => ({ method_payment_type_id: {} })),
  }),
  { virtual: true },
);

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const MethodPaymentType = require("../models/method-payment-type");
const Currency = require("../models/currency");
const User = require("../models/user");
const router = require("./index");

const app = express();
app.use(express.json());
app.use("/method-payment-types", router);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
};
const FIELD = {
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
};
const BODY = {
  code: "PAYPAL",
  name: "PayPal",
  currency_id: 3,
  fields: [FIELD],
};

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role to embed in the token.
 * @returns {string} The signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored type double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The type double.
 */
function storedType(overrides = {}) {
  return {
    id: 1,
    code: "PAYPAL",
    name: "PayPal",
    currency_id: 3,
    currency: CURRENCY,
    fields: [FIELD],
    description: "Pagos por PayPal",
    is_active: true,
    ...overrides,
  };
}

/**
 * Sends an authenticated request to the module router.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {object} [body] - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function call(method, path, body, token = tokenFor()) {
  const req = request(app)[method](path);

  if (body !== undefined) {
    req.send(body);
  }

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  MethodPaymentType.create.mockReset();
  MethodPaymentType.findAll.mockReset();
  MethodPaymentType.findByPk.mockReset();
  Currency.findOne.mockReset();
  Currency.findByPk.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findOne.mockResolvedValue(CURRENCY);
});

describe("POST /method-payment-types", () => {
  it("creates a type, normalizes code and answers 201 with nested currency", async () => {
    MethodPaymentType.create.mockImplementation(async (values) => ({
      id: 1,
      ...values,
    }));
    MethodPaymentType.findByPk.mockResolvedValue(
      storedType({ description: null }),
    );

    const response = await call("post", "/method-payment-types", {
      code: " paypal ",
      name: "PayPal",
      currency_id: 3,
      fields: [FIELD],
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      currency: CURRENCY,
      fields: [FIELD],
      description: null,
      is_active: true,
    });
    expect(MethodPaymentType.create).toHaveBeenCalledWith({
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      fields: [FIELD],
      description: null,
      is_active: true,
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");
  });

  it("responds 400 when required fields are missing", async () => {
    const response = await call("post", "/method-payment-types", {});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "code, name and currency_id are required",
    });
    expect(MethodPaymentType.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "A" }, { code: expect.stringContaining("code") }],
    [{ name: "   " }, { name: expect.stringContaining("name") }],
    [{ currency_id: "abc" }, { currency_id: "Invalid currency" }],
    [{ fields: [{ key: "email" }] }, { fields: "Invalid fields definition" }],
    [
      { fields: [FIELD, { ...FIELD, label: "Duplicado" }] },
      { fields: "Invalid fields definition" },
    ],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await call("post", "/method-payment-types", {
      ...BODY,
      ...body,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(MethodPaymentType.create).not.toHaveBeenCalled();
  });

  it("responds 422 Invalid currency when the currency is missing or inactive", async () => {
    Currency.findOne.mockResolvedValue(null);

    const response = await call("post", "/method-payment-types", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
    expect(MethodPaymentType.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the code already exists", async () => {
    MethodPaymentType.create.mockRejectedValue(
      new UniqueConstraintError({ message: "duplicate" }),
    );

    const response = await call("post", "/method-payment-types", BODY);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment type already exists" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call("post", "/method-payment-types", BODY, null);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const seller = await call(
      "post",
      "/method-payment-types",
      BODY,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(MethodPaymentType.create).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    MethodPaymentType.create.mockRejectedValue(new Error("database exploded"));

    const response = await call("post", "/method-payment-types", BODY);

    expect(response.status).toBe(500);
  });
});
