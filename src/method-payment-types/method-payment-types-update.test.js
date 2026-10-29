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
  Currency.findOne.mockReset();
  User.findByPk.mockReset();
  MethodPayment.count.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findOne.mockResolvedValue(CURRENCY);
  MethodPayment.count.mockResolvedValue(0);
});

describe("PUT /method-payment-types/:id", () => {
  it("updates the editable fields and answers 202", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("put", "/method-payment-types/1", {
      name: "PayPal actualizado",
      description: "  Pagos  ",
      is_active: false,
    });

    expect(response.status).toBe(202);
    expect(type.update).toHaveBeenCalledWith({
      name: "PayPal actualizado",
      description: "Pagos",
      is_active: false,
    });
    expect(response.body).toEqual(
      expect.objectContaining({
        id: 1,
        code: "PAYPAL",
        name: "PayPal actualizado",
        description: "Pagos",
        is_active: false,
      }),
    );
  });

  it("ignores code because it is immutable", async () => {
    const type = target();
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("put", "/method-payment-types/1", {
      code: "OTHER",
      name: "Banco",
    });

    expect(response.status).toBe(202);
    expect(type.update).toHaveBeenCalledWith({ name: "Banco" });
    expect(response.body.code).toBe("PAYPAL");
  });

  it("responds 400 when no editable field is provided", async () => {
    const response = await call("put", "/method-payment-types/1", {
      code: "OTHER",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "At least one field is required",
    });
    expect(MethodPaymentType.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "   " }, { name: expect.stringContaining("name") }],
    [{ currency_id: 0 }, { currency_id: "Invalid currency" }],
    [
      { fields: [{ ...FIELD, key: "A" }] },
      { fields: "Invalid fields definition" },
    ],
    [{ is_active: "false" }, { is_active: "is_active must be a boolean" }],
  ])("responds 422 when the body is invalid in %p", async (body, errors) => {
    const response = await call("put", "/method-payment-types/1", body);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(MethodPaymentType.findByPk).not.toHaveBeenCalled();
  });

  it("responds 404 for an unknown type", async () => {
    MethodPaymentType.findByPk.mockResolvedValue(null);

    const response = await call("put", "/method-payment-types/999", {
      name: "Banco",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment type not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await call("put", `/method-payment-types/${id}`, {
        name: "Banco",
      });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid payment type id" },
      });
      expect(MethodPaymentType.findByPk).not.toHaveBeenCalled();
    },
  );

  it("responds 401 and 403 for unauthorized requests", async () => {
    const anonymous = await call(
      "put",
      "/method-payment-types/1",
      { name: "Banco" },
      null,
    );
    expect(anonymous.status).toBe(401);

    const seller = await call(
      "put",
      "/method-payment-types/1",
      { name: "Banco" },
      tokenFor("seller"),
    );
    expect(seller.status).toBe(403);
    expect(seller.body).toEqual({ message: "Forbidden" });
    expect(MethodPaymentType.findByPk).not.toHaveBeenCalled();
  });

  it("forwards unexpected persistence errors", async () => {
    const type = target();
    type.update.mockRejectedValue(new Error("database exploded"));
    MethodPaymentType.findByPk.mockResolvedValue(type);

    const response = await call("put", "/method-payment-types/1", {
      name: "Banco",
    });

    expect(response.status).toBe(500);
  });
});
