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
const MethodPaymentType = require("../models/method-payment-type");
const MethodPayment = require("../models/method-payment");
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
 * Builds a stored type double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored type double.
 */
function target(overrides = {}) {
  return {
    id: 1,
    code: "PAYPAL",
    name: "PayPal",
    currency_id: 3,
    currency: CURRENCY,
    fields: [FIELD],
    description: "Pagos por PayPal",
    is_active: true,
    update: jest.fn(function update(values) {
      Object.assign(this, values);
      return Promise.resolve(this);
    }),
    destroy: jest.fn().mockResolvedValue(),
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
  MethodPaymentType.findByPk.mockReset();
  Currency.findOne.mockReset();
  User.findByPk.mockReset();
  MethodPayment.count.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findOne.mockResolvedValue(CURRENCY);
  MethodPayment.count.mockResolvedValue(0);
});

describe("PUT protected references", () => {
  it("updates currency_id and fields when there are no methods", async () => {
    const type = target();
    const fields = [{ ...FIELD, required: false }];
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("put", "/method-payment-types/1", {
      currency_id: 4,
      fields,
    });

    expect(response.status).toBe(202);
    expect(Currency.findOne).toHaveBeenCalledWith({
      where: { id: 4, is_active: true },
    });
    expect(type.update).toHaveBeenCalledWith({ currency_id: 4, fields });
  });

  it("responds 409 when it tries to change currency_id with methods", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);
    MethodPayment.count.mockResolvedValue(2);

    const response = await call("put", "/method-payment-types/1", {
      currency_id: 4,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment type has methods" });
    expect(type.update).not.toHaveBeenCalled();
    expect(Currency.findOne).not.toHaveBeenCalled();
  });

  it("responds 409 when it tries to change fields with methods", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);
    MethodPayment.count.mockResolvedValue(2);

    const response = await call("put", "/method-payment-types/1", {
      fields: [{ ...FIELD, required: false }],
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment type has methods" });
    expect(type.update).not.toHaveBeenCalled();
  });

  it("allows the current currency_id and fields when there are methods", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);
    MethodPayment.count.mockResolvedValue(2);

    const response = await call("put", "/method-payment-types/1", {
      name: "PayPal",
      currency_id: 3,
      fields: [{ ...FIELD }],
    });

    expect(response.status).toBe(202);
    expect(type.update).toHaveBeenCalledWith({ name: "PayPal" });
  });

  it("responds 422 Invalid currency when the new currency is inactive", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);
    Currency.findOne.mockResolvedValue(null);

    const response = await call("put", "/method-payment-types/1", {
      currency_id: 4,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
    expect(type.update).not.toHaveBeenCalled();
  });
});
