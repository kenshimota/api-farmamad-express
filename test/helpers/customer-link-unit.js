const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");
const sequelize = require("../../src/database");
const customerLinkRouter = require("../../src/users/customer-link");

const app = express();
app.use(express.json());
app.use("/users", customerLinkRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const AUTH_USER = { id: 1, username: "admin", isBlocked: false, roleId: 1 };
const CUSTOMER = {
  id: 8,
  fullName: "Cliente Demo",
  latitude: "-17.7833000",
  longitude: "-63.1821000",
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
  isRegistered: true,
  createdAt: "2026-09-01T00:00:00.000Z",
};
const PUBLIC_CUSTOMER = {
  id: 8,
  fullName: "Cliente Demo",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
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
 * Builds a target user double with a working update method.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The user double.
 */
function target(overrides = {}) {
  return {
    id: 2,
    username: "cliente",
    email: "cliente@example.com",
    name: "Cliente Demo",
    isBlocked: false,
    roleId: 2,
    roleName: "customer",
    customer_id: null,
    setDataValue: jest.fn(function setDataValue(key, value) {
      this[key] = value;
    }),
    update: jest.fn(function update(values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

/**
 * Makes the authentication lookup return the admin and the handler lookup
 * return the provided target.
 * @param {object|null} user - Target user returned for ids other than 1.
 * @returns {void}
 */
function mockLookup(user) {
  User.findByPk.mockImplementation((id) =>
    Promise.resolve(Number(id) === AUTH_USER.id ? AUTH_USER : user),
  );
  Role.findByPk.mockImplementation((id) =>
    Promise.resolve(user ? { id, name: user.roleName || "customer" } : null),
  );
}

/**
 * Sends a PUT /users/:id/customer request.
 * @param {unknown} id - Route id.
 * @param {object} body - Request body.
 * @param {string|null} [token] - Bearer token, null to omit the header.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function put(id, body, token = tokenFor()) {
  const req = request(app).put(`/users/${id}/customer`);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

/**
 * Resets the model and transaction mocks shared by the suite.
 * @returns {void}
 */
function resetMocks() {
  User.findByPk.mockReset();
  User.findOne.mockReset();
  Role.findByPk.mockReset();
  Customer.findByPk.mockReset();
  sequelize.transaction.mockReset();
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  mockLookup(target());
}

module.exports = {
  CUSTOMER,
  PUBLIC_CUSTOMER,
  TRANSACTION,
  mockLookup,
  put,
  resetMocks,
  target,
  tokenFor,
};
