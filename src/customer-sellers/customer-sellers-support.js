process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./repository", () => ({
  customerSellerRepository: {
    transaction: jest.fn((callback) => callback("tx")),
    create: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findCustomer: jest.fn(),
    findSeller: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { customerSellerRepository: repository } = require("./repository");
const router = require("./index");

const app = express();
app.use(express.json());
app.use("/customer-sellers", router);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

/**
 * Signs a JWT for the given subject and role.
 * @param {number} [sub] - User id.
 * @param {string} [role] - Role name.
 * @returns {string} Signed JWT.
 */
function tokenFor(sub = 1, role = "admin") {
  return jwt.sign({ sub, username: `user${sub}`, role }, "test-secret", {
    expiresIn: "1h",
  });
}

/**
 * Builds a stored assignment double with nested relations.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The assignment double.
 */
function storedAssignment(overrides = {}) {
  return {
    id: 1,
    customer_id: 8,
    seller_id: 12,
    assigned_at: "2026-10-29T16:00:00.000Z",
    customer: {
      id: 8,
      fullName: "Juan Pérez",
      email: "juan@example.com",
      direction: "Av. Monseñor Rivero 123",
    },
    seller: {
      id: 12,
      username: "vendedor1",
      email: "vendedor1@farmamad.com",
      name: "Carlos Gómez",
    },
    ...overrides,
  };
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {string|null} token - Bearer token.
 * @returns {import("supertest").Test} The request.
 */
function as(method, path, token) {
  const req = request(app)[method](path);

  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

/**
 * Restores the successful repository defaults before each test.
 * @returns {void}
 */
function resetDoubles() {
  jest.clearAllMocks();
  repository.transaction.mockImplementation((callback) => callback("tx"));
  repository.create.mockResolvedValue({ id: 1 });
  repository.findById.mockResolvedValue(storedAssignment());
  repository.findByCustomerId.mockResolvedValue(null);
  repository.list.mockResolvedValue([storedAssignment()]);
  repository.update.mockResolvedValue();
  repository.remove.mockResolvedValue();
  repository.findCustomer.mockResolvedValue({ id: 8 });
  repository.findSeller.mockResolvedValue({
    id: 12,
    isBlocked: false,
    role: { name: "seller" },
  });
  User.findByPk.mockResolvedValue({ id: 1, isBlocked: false });
}

module.exports = {
  as,
  repository,
  resetDoubles,
  storedAssignment,
  tokenFor,
};
