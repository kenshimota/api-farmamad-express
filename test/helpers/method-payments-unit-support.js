const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const router = require("../../src/method-payments/index");

const SECRET = "test-secret";
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  is_active: true,
};
const FIELD = {
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
};
const TYPE = {
  id: 1,
  code: "PAYPAL",
  name: "PayPal",
  currency_id: 3,
  currency: CURRENCY,
  fields: [FIELD],
  is_active: true,
};
const BODY = {
  method_payment_type_id: 1,
  label: "PayPal Farmamad",
  details: { email: "pagos@farmamad.com" },
};

const app = express();
app.use(express.json());
app.use("/method-payments", router);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

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
 * Builds a stored method payment double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The method payment double.
 */
function storedMethod(overrides = {}) {
  return {
    id: 1,
    method_payment_type_id: 1,
    label: "PayPal Farmamad",
    details: { email: "pagos@farmamad.com" },
    is_active: true,
    method_payment_type: TYPE,
    ...overrides,
  };
}

/**
 * Builds a stored method double with working write methods.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Stored method double.
 */
function target(overrides = {}) {
  return {
    ...storedMethod(),
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

module.exports = {
  AUTH_USER,
  BODY,
  CURRENCY,
  FIELD,
  SECRET,
  TRANSACTION,
  TYPE,
  app,
  call,
  storedMethod,
  target,
  tokenFor,
};
