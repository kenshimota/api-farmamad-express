process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/role", () => ({ findOne: jest.fn() }));
jest.mock("../models/customer", () => ({}));
jest.mock("../models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const authRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

const SECRET = "test-secret";
const PASSWORD = "secret123";
const user = {
  id: 1,
  username: "juan",
  email: "juan@example.com",
  name: "Juan",
  password: bcrypt.hashSync(PASSWORD, 10),
  role: { name: "customer" },
  isBlocked: false,
  customer_id: 8,
};
const linkedCustomer = {
  id: 8,
  fullName: "Cliente Demo",
  latitude: "-17.7833000",
  longitude: "-63.1821000",
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
  isRegistered: true,
  createdAt: "2026-09-01T00:00:00.000Z",
};
const publicUser = {
  id: 1,
  username: "juan",
  email: "juan@example.com",
  name: "Juan",
  role: "customer",
  isBlocked: false,
};
const publicCustomer = {
  id: 8,
  fullName: "Cliente Demo",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
};

beforeEach(() => {
  User.findOne.mockReset();
  User.findByPk.mockReset();
});

describe("customer link in authentication", () => {
  it("returns the linked customer summary on login", async () => {
    User.findOne.mockResolvedValue({ ...user, customer: linkedCustomer });

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "juan", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      ...publicUser,
      customer_id: 8,
      customer: publicCustomer,
    });
    expect(response.body.user.customer).not.toHaveProperty("isRegistered");
    expect(response.body.user.customer).not.toHaveProperty("createdAt");
  });

  it("returns the linked customer summary on GET /auth/me", async () => {
    const token = jwt.sign({ sub: 1 }, SECRET, { expiresIn: "1h" });
    User.findByPk.mockResolvedValue({ ...user, customer: linkedCustomer });

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...publicUser,
      customer_id: 8,
      customer: publicCustomer,
    });
  });
});
