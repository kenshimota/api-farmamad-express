process.env.JWT_SECRET = "test-secret";

jest.mock("../models/user", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/role", () => ({ findOne: jest.fn() }));
jest.mock("../models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../database", () => ({ transaction: jest.fn() }));
jest.mock("./mailer", () => {
  class MailDeliveryError extends Error {}

  return { sendRecoveryCode: jest.fn(), MailDeliveryError };
});

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const PasswordResetCode = require("../models/password-reset-code");
const sequelize = require("../database");
const clock = require("./clock");
const passwordResetRouter = require("./password-reset");

const app = express();
app.use(express.json());
app.use("/auth", passwordResetRouter);

const SECRET = "test-secret";
const NEW_PASSWORD = "nuevaClave123";
const NOW = new Date("2026-01-01T00:00:00.000Z");
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };

const resetPassword = (body, token) => {
  const req = request(app).post("/auth/reset-password");

  return (token ? req.set("Authorization", `Bearer ${token}`) : req).send(body);
};

let user;
let token;

beforeEach(() => {
  clock.setClock(() => NOW);
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  PasswordResetCode.update.mockResolvedValue([0]);
  user = {
    id: 1,
    username: "juan",
    email: "juan@example.com",
    name: "Juan",
    password: "hashed-password",
    role: { name: "customer" },
    save: jest.fn(),
  };
  token = jwt.sign({ sub: 1, username: "juan", role: "customer" }, SECRET, {
    expiresIn: "1h",
  });
});

afterEach(() => {
  clock.resetClock();
});

describe("POST /auth/reset-password", () => {
  const body = {
    password: NEW_PASSWORD,
    passwordConfirmation: NEW_PASSWORD,
  };

  it("responds 401 without a token", async () => {
    const response = await resetPassword(body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 401 when the token is invalid", async () => {
    const response = await resetPassword(body, "not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 400 when a required field is missing", async () => {
    const response = await resetPassword({ password: NEW_PASSWORD }, token);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "password and passwordConfirmation are required",
    });
  });

  it("responds 422 when the password is too short", async () => {
    const response = await resetPassword(
      { password: "short", passwordConfirmation: "short" },
      token,
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { password: "Password must be at least 8 characters long" },
    });
  });

  it("responds 422 when the confirmation does not match", async () => {
    const response = await resetPassword(
      { password: NEW_PASSWORD, passwordConfirmation: "otraClave123" },
      token,
    );

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { passwordConfirmation: "Passwords do not match" },
    });
  });

  it("responds 401 when the authenticated user no longer exists", async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await resetPassword(body, token);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("updates the password and invalidates every pending code", async () => {
    User.findByPk.mockResolvedValue(user);

    const response = await resetPassword(body, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Password updated" });
    expect(response.body).not.toHaveProperty("password");
    expect(user.save).toHaveBeenCalledWith({ transaction: TRANSACTION });
    expect(PasswordResetCode.update).toHaveBeenCalledWith(
      { consumedAt: NOW },
      { where: { userId: 1, consumedAt: null }, transaction: TRANSACTION },
    );
  });
});
