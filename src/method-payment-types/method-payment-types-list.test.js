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
const Currency = require("../models/currency");
const User = require("../models/user");
const router = require("./index");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

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
const INCLUDE = [
  {
    model: Currency,
    as: "currency",
    attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
  },
];

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
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function call(method, path, token = tokenFor()) {
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

beforeEach(() => {
  MethodPaymentType.findAll.mockReset();
  MethodPaymentType.findByPk.mockReset();
  Currency.findOne.mockReset();
  User.findByPk.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
  Currency.findOne.mockResolvedValue(CURRENCY);
});

describe("GET /method-payment-types", () => {
  it.each(["admin", "seller", "dispatcher"])(
    "allows a %s to list types",
    async (role) => {
      MethodPaymentType.findAll.mockResolvedValue([storedType()]);

      const response = await call(
        "get",
        "/method-payment-types",
        tokenFor(role),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          code: "PAYPAL",
          name: "PayPal",
          currency_id: 3,
          currency: CURRENCY,
          fields: [FIELD],
          description: "Pagos por PayPal",
          is_active: true,
        },
      ]);
      expect(MethodPaymentType.findAll).toHaveBeenCalledWith({
        order: [["code", "ASC"]],
        include: INCLUDE,
      });
    },
  );

  it("filters by currency_id and is_active together", async () => {
    MethodPaymentType.findAll.mockResolvedValue([]);

    const response = await call(
      "get",
      "/method-payment-types?currency_id=3&is_active=false",
    );

    expect(response.status).toBe(200);
    expect(MethodPaymentType.findAll).toHaveBeenCalledWith({
      order: [["code", "ASC"]],
      include: INCLUDE,
      where: { currency_id: 3, is_active: false },
    });
  });

  it.each([
    ["is_active=maybe", { is_active: "Invalid is_active" }],
    ["currency_id=abc", { currency_id: "Invalid currency_id" }],
    ["currency_id=0", { currency_id: "Invalid currency_id" }],
  ])("responds 422 for the invalid query %s", async (query, errors) => {
    const response = await call("get", `/method-payment-types?${query}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors });
    expect(MethodPaymentType.findAll).not.toHaveBeenCalled();
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 when the authenticated user is %s",
    async (role) => {
      const response = await call(
        "get",
        "/method-payment-types",
        tokenFor(role),
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await call("get", "/method-payment-types", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("GET /method-payment-types/:id", () => {
  it("returns the detail with the nested currency", async () => {
    MethodPaymentType.findByPk.mockResolvedValue(storedType());

    const response = await call("get", "/method-payment-types/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      currency: CURRENCY,
      fields: [FIELD],
      description: "Pagos por PayPal",
      is_active: true,
    });
    expect(MethodPaymentType.findByPk).toHaveBeenCalledWith(1, {
      include: INCLUDE,
    });
  });

  it("responds 404 when the type does not exist", async () => {
    MethodPaymentType.findByPk.mockResolvedValue(null);

    const response = await call("get", "/method-payment-types/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Payment type not found" });
  });

  it.each(["abc", "0", "-1", "1.5"])(
    "responds 422 when the id is %s",
    async (id) => {
      const response = await call("get", `/method-payment-types/${id}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { id: "Invalid payment type id" },
      });
      expect(MethodPaymentType.findByPk).not.toHaveBeenCalled();
    },
  );
});
