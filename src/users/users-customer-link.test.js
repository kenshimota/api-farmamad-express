process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
}));
jest.mock("../models/role", () => ({ findOne: jest.fn() }));
jest.mock("../models/customer", () => ({ findByPk: jest.fn() }));
jest.mock("../database", () => ({ transaction: jest.fn() }));
jest.mock("../auth/mailer", () => ({ sendWelcomeEmail: jest.fn() }));
jest.mock("../config/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const User = require("../models/user");
const Role = require("../models/role");
const Customer = require("../models/customer");
const usersRouter = require("./index");
const { sendWelcomeEmail } = require("../auth/mailer");

const app = express();
app.use(express.json());
app.use("/users", usersRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const CUSTOMER_ROLE = { id: 1, name: "customer" };
const SELLER_ROLE = { id: 2, name: "seller" };
const validBody = {
  username: "cliente",
  email: "cliente@example.com",
  password: "secret123",
  name: "Cliente Demo",
  role: "customer",
};
const createdCustomer = {
  id: 8,
  fullName: "Cliente Demo",
  latitude: "-17.7833000",
  longitude: "-63.1821000",
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
  isRegistered: false,
};
const createdUser = {
  id: 2,
  username: "cliente",
  email: "cliente@example.com",
  name: "Cliente Demo",
  roleId: CUSTOMER_ROLE.id,
  isBlocked: false,
  customer_id: 8,
};

/**
 * Signs a JWT for the administrator role.
 * @returns {string} Signed JWT.
 */
function token() {
  return jwt.sign({ sub: 1, username: "admin", role: "admin" }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Sends a POST /users request.
 * @param {object} body - Request body.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function post(body) {
  return request(app)
    .post("/users")
    .set("Authorization", `Bearer ${token()}`)
    .send(body);
}

beforeEach(() => {
  User.create.mockReset();
  User.findOne.mockReset();
  User.findByPk.mockReset();
  Role.findOne.mockReset();
  Customer.findByPk.mockReset();
  sendWelcomeEmail.mockReset();
  User.findByPk.mockResolvedValue(AUTH_USER);
});

describe("POST /users with customer_id", () => {
  it("creates a customer user linked to a customer", async () => {
    Role.findOne.mockResolvedValue(CUSTOMER_ROLE);
    Customer.findByPk.mockResolvedValue(createdCustomer);
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ ...createdUser });

    const response = await post({ ...validBody, customer_id: 8 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 2,
      username: "cliente",
      email: "cliente@example.com",
      name: "Cliente Demo",
      role: "customer",
      isBlocked: false,
      customer_id: 8,
      customer: {
        id: 8,
        fullName: "Cliente Demo",
        latitude: -17.7833,
        longitude: -63.1821,
        direction: "Av. Monseñor Rivero 123",
        email: "cliente@example.com",
      },
    });
    expect(Customer.findByPk).toHaveBeenCalledWith(8);
    expect(User.create).toHaveBeenCalledWith({
      username: "cliente",
      email: "cliente@example.com",
      password: "secret123",
      name: "Cliente Demo",
      role: "customer",
      roleId: 1,
      customer_id: 8,
    });
  });

  it("responds 422 when a non customer role receives customer_id", async () => {
    Role.findOne.mockResolvedValue(SELLER_ROLE);

    const response = await post({
      ...validBody,
      role: "seller",
      customer_id: 8,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "User is not a customer" },
    });
    expect(Customer.findByPk).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it.each(["8", 1.5, 0, -1, true])(
    "responds 422 when customer_id is %p",
    async (value) => {
      const response = await post({ ...validBody, customer_id: value });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        errors: { customer_id: "Invalid customer id" },
      });
      expect(User.create).not.toHaveBeenCalled();
    },
  );

  it("responds 422 when the customer does not exist", async () => {
    Role.findOne.mockResolvedValue(CUSTOMER_ROLE);
    Customer.findByPk.mockResolvedValue(null);

    const response = await post({ ...validBody, customer_id: 8 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "Invalid customer" },
    });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the customer is already linked", async () => {
    Role.findOne.mockResolvedValue(CUSTOMER_ROLE);
    Customer.findByPk.mockResolvedValue(createdCustomer);
    User.findOne.mockResolvedValue({ id: 99 });

    const response = await post({ ...validBody, customer_id: 8 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer is already linked to a user",
    });
    expect(User.create).not.toHaveBeenCalled();
  });

  it("answers 409 when the unique link is taken during creation", async () => {
    Role.findOne.mockResolvedValue(CUSTOMER_ROLE);
    Customer.findByPk.mockResolvedValue(createdCustomer);
    User.findOne.mockResolvedValue(null);
    User.create.mockRejectedValue(
      new UniqueConstraintError({ fields: { customer_id: 8 } }),
    );

    const response = await post({ ...validBody, customer_id: 8 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer is already linked to a user",
    });
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
