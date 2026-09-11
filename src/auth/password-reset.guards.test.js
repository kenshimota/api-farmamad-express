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
const internalErrors = [];

app.use(express.json());
app.use("/auth", passwordResetRouter);
app.use((error, req, res, next) => {
  internalErrors.push(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({ message: "Internal server error" });
});

const SECRET = "test-secret";
const NOW = new Date("2026-01-01T00:00:00.000Z");
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };

const forgotPassword = (body) =>
  request(app).post("/auth/forgot-password").send(body);
const verifyResetCode = (body) =>
  request(app).post("/auth/verify-reset-code").send(body);

let user;
let token;

beforeEach(() => {
  clock.setClock(() => NOW);
  internalErrors.length = 0;
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  PasswordResetCode.create.mockResolvedValue({});
  PasswordResetCode.update.mockResolvedValue([0]);
  user = {
    id: 1,
    username: "juan",
    email: "juan@example.com",
    name: "Juan",
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

describe("forgot-password guards", () => {
  it("stops the handler after a 400 response", async () => {
    const response = await forgotPassword({});

    expect(response.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(internalErrors).toEqual([]);
  });

  it("stops the handler after a 422 response", async () => {
    const response = await forgotPassword({ email: "invalid@" });

    expect(response.status).toBe(422);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(internalErrors).toEqual([]);
  });

  it("looks up the user by the trimmed email", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await forgotPassword({ email: "  juan@example.com  " });

    expect(response.status).toBe(200);
    expect(User.findOne).toHaveBeenCalledWith({
      where: { email: "juan@example.com" },
    });
    expect(internalErrors).toEqual([]);
  });
});

describe("verify-reset-code guards", () => {
  it("stops the handler after a 400 response", async () => {
    const response = await verifyResetCode({ email: "juan@example.com" });

    expect(response.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(internalErrors).toEqual([]);
  });

  it("stops the handler after a 422 response", async () => {
    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "1234",
    });

    expect(response.status).toBe(422);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(internalErrors).toEqual([]);
  });

  it("looks up the user including its role", async () => {
    User.findOne.mockResolvedValue(user);
    PasswordResetCode.findOne.mockResolvedValue(null);

    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "00427193",
    });

    expect(response.status).toBe(401);
    expect(User.findOne).toHaveBeenCalledWith({
      where: { email: "juan@example.com" },
      include: { model: expect.anything(), as: "role" },
    });
    expect(internalErrors).toEqual([]);
  });
});

describe("reset-password guards", () => {
  const resetPassword = (body) =>
    request(app)
      .post("/auth/reset-password")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("stops the handler after a 400 response", async () => {
    const response = await resetPassword({ password: "nuevaClave123" });

    expect(response.status).toBe(400);
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(internalErrors).toEqual([]);
  });

  it("stops the handler after a 422 response", async () => {
    const response = await resetPassword({
      password: "nuevaClave123",
      passwordConfirmation: "otraClave123",
    });

    expect(response.status).toBe(422);
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(internalErrors).toEqual([]);
  });
});
