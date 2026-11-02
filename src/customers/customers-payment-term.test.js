process.env.JWT_SECRET = "test-secret";

jest.mock("../models/customer", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../models/payment-term", () => ({ findByPk: jest.fn() }));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");
const User = require("../models/user");
const PaymentTerm = require("../models/payment-term");
const customersRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/customers", customersRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const validBody = {
  fullName: "Juan Pérez",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "juan@example.com",
};

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
 * Builds a stored customer double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The customer double.
 */
function storedCustomer(overrides = {}) {
  return {
    id: 1,
    fullName: "Juan Pérez",
    latitude: "-17.7833000",
    longitude: "-63.1821000",
    direction: "Av. Monseñor Rivero 123",
    email: "juan@example.com",
    ...overrides,
  };
}

/**
 * Sends a POST /customers request.
 * @param {object} body - Request body.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body) {
  return request(app)
    .post("/customers")
    .set("Authorization", `Bearer ${tokenFor()}`)
    .send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("customer payment term assignment", () => {
  it("assigns an active payment term and exposes its summary", async () => {
    const term = {
      id: 2,
      code: "credit_10",
      name: "Crédito 10 días",
      days: 10,
      is_active: true,
    };
    PaymentTerm.findByPk.mockResolvedValue(term);
    Customer.create.mockResolvedValue(storedCustomer({ payment_term_id: 2 }));
    Customer.findByPk.mockResolvedValue(
      storedCustomer({ payment_term_id: 2, payment_term: term }),
    );

    const response = await post({ ...validBody, payment_term_id: 2 });

    expect(response.status).toBe(201);
    expect(Customer.create).toHaveBeenCalledWith({
      ...validBody,
      payment_term_id: 2,
    });
    expect(response.body.payment_term_id).toBe(2);
    expect(response.body.payment_term).toEqual({
      id: 2,
      code: "credit_10",
      name: "Crédito 10 días",
      days: 10,
    });
  });

  it("responds 422 when the payment term does not exist or is inactive", async () => {
    PaymentTerm.findByPk.mockResolvedValue({ id: 2, is_active: false });

    const response = await post({ ...validBody, payment_term_id: 2 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { payment_term_id: "Invalid payment term" },
    });
    expect(Customer.create).not.toHaveBeenCalled();
  });

  it("responds 422 when the payment term id is not a positive integer", async () => {
    const response = await post({ ...validBody, payment_term_id: 0 });

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty("payment_term_id");
    expect(Customer.create).not.toHaveBeenCalled();
  });
});
