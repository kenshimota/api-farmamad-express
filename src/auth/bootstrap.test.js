process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../models/role", () => ({ findOne: jest.fn() }));

jest.mock("../models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

jest.mock("../database", () => ({ transaction: jest.fn() }));

jest.mock("./mailer", () => {
  const actual = jest.requireActual("./mailer");

  return {
    ...actual,
    sendRecoveryCode: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  };
});

jest.mock("../config/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const User = require("../models/user");
const Role = require("../models/role");
const sequelize = require("../database");
const authRouter = require("./index");
const { sendWelcomeEmail } = require("./mailer");
const logger = require("../config/logger");

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

const ADMIN_ROLE = { id: 1, name: "admin" };
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const validBody = {
  username: "admin",
  email: "admin@superking.com",
  password: "secret123",
  name: "Administrador",
};

const register = (body) => request(app).post("/auth/register-admin").send(body);

beforeEach(() => {
  User.findOne.mockReset();
  User.count.mockReset();
  User.create.mockReset();
  Role.findOne.mockReset();
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  sendWelcomeEmail.mockReset();
  logger.error.mockReset();
});

describe("GET /auth/setup-status", () => {
  it("responds hasAdmin false when the administrator role is missing", async () => {
    Role.findOne.mockResolvedValue(null);

    const response = await request(app).get("/auth/setup-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasAdmin: false });
    expect(User.count).not.toHaveBeenCalled();
  });

  it("responds hasAdmin false when there are no administrators", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.count.mockResolvedValue(0);

    const response = await request(app).get("/auth/setup-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasAdmin: false });
    expect(Role.findOne).toHaveBeenCalledWith({
      where: { name: "admin" },
    });
    expect(User.count).toHaveBeenCalledWith({ where: { roleId: 1 } });
  });

  it("responds hasAdmin true when at least one administrator exists", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.count.mockResolvedValue(2);

    const response = await request(app).get("/auth/setup-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasAdmin: true });
  });
});

describe("POST /auth/register-admin", () => {
  it("creates the first administrator inside a transaction", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      username: "admin",
      email: "admin@superking.com",
      name: "Administrador",
      roleId: 1,
    });

    const response = await register(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 1,
      username: "admin",
      email: "admin@superking.com",
      name: "Administrador",
      role: "admin",
      isBlocked: false,
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("roleId");
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(Role.findOne).toHaveBeenCalledWith({
      where: { name: "admin" },
      transaction: TRANSACTION,
      lock: "UPDATE",
    });
    expect(User.findOne).toHaveBeenCalledWith({
      where: { roleId: 1 },
      transaction: TRANSACTION,
    });
    expect(User.create).toHaveBeenCalledWith(
      {
        username: "admin",
        email: "admin@superking.com",
        password: "secret123",
        name: "Administrador",
        roleId: 1,
      },
      { transaction: TRANSACTION },
    );
  });

  it("forces the administrator role even when the client sends another role", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      username: "admin",
      email: "admin@superking.com",
      name: null,
      roleId: 1,
    });

    const response = await register({ ...validBody, role: "customer" });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe("admin");
    expect(User.create).toHaveBeenCalledWith(
      {
        username: "admin",
        email: "admin@superking.com",
        password: "secret123",
        name: "Administrador",
        roleId: 1,
      },
      { transaction: TRANSACTION },
    );
  });

  it("sends a welcome email after the administrator is created", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      username: "admin",
      email: "admin@superking.com",
      name: "Administrador",
      roleId: 1,
    });
    sendWelcomeEmail.mockResolvedValue(undefined);

    const response = await register(validBody);

    expect(response.status).toBe(201);
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      "admin@superking.com",
      "Administrador",
    );
  });

  it("still responds 201 and logs when the welcome email fails", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      username: "admin",
      email: "admin@superking.com",
      name: "Administrador",
      roleId: 1,
    });
    const error = new Error("connection refused");
    sendWelcomeEmail.mockRejectedValue(error);

    const response = await register(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 1,
      username: "admin",
      email: "admin@superking.com",
      name: "Administrador",
      role: "admin",
      isBlocked: false,
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Could not send the welcome email",
      { email: "admin@superking.com", error },
    );
  });

  it("responds 409 when an administrator already exists", async () => {
    Role.findOne.mockResolvedValue(ADMIN_ROLE);
    User.findOne.mockResolvedValue({ id: 9 });

    const response = await register(validBody);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Admin already exists" });
    expect(User.create).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("responds 500 when the administrator role is not configured", async () => {
    Role.findOne.mockResolvedValue(null);

    const response = await register(validBody);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Server error" });
    expect(User.create).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["all fields are missing", {}, "username, email and password are required"],
    [
      "username is missing",
      { email: "a@b.com", password: "secret123" },
      "username is required",
    ],
    [
      "email is missing",
      { username: "admin", password: "secret123" },
      "email is required",
    ],
    [
      "password is missing",
      { username: "admin", email: "a@b.com" },
      "password is required",
    ],
  ])("responds 400 when %s", async (_case, body, message) => {
    const response = await register(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it("responds 422 with field errors for invalid fields", async () => {
    const response = await register({
      username: "admin",
      email: "invalid@",
      password: "short",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        email: "Invalid email",
        password: "Password must be at least 8 characters long",
      },
    });
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
});
