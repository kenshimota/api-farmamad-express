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
const { ForeignKeyConstraintError } = require("sequelize");
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
 * Builds a stored type double with working update and destroy methods.
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
  User.findByPk.mockReset();
  MethodPayment.count.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  MethodPayment.count.mockResolvedValue(0);
});

describe("DELETE /method-payment-types/:id", () => {
  it("removes the type and answers 204", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("delete", "/method-payment-types/1");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(type.destroy).toHaveBeenCalledTimes(1);
  });

  it("responds 409 when the type has methods", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);
    MethodPayment.count.mockResolvedValue(1);

    const response = await call("delete", "/method-payment-types/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment type has methods" });
    expect(type.destroy).not.toHaveBeenCalled();
  });

  it("responds 409 when a foreign key blocks the delete", async () => {
    const type = target();
    type.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ message: "foreign key" }),
    );
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("delete", "/method-payment-types/1");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Payment type has methods" });
  });

  it("responds 404 for an unknown type", async () => {
    MethodPaymentType.findByPk.mockResolvedValue(null);

    const response = await call("delete", "/method-payment-types/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment type not found" });
  });

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call(
      "delete",
      "/method-payment-types/1",
      undefined,
      null,
    );
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "delete",
      "/method-payment-types/1",
      undefined,
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
  });

  it("forwards unexpected persistence errors", async () => {
    const type = target();
    type.destroy.mockRejectedValue(new Error("database exploded"));
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("delete", "/method-payment-types/1");

    expect(response.status).toBe(500);
  });
});
