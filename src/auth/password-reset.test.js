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
  class MailDeliveryError extends Error {
    constructor(message = "mail failed") {
      super(message);
      this.name = "MailDeliveryError";
    }
  }

  return { sendRecoveryCode: jest.fn(), MailDeliveryError };
});

const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const PasswordResetCode = require("../models/password-reset-code");
const sequelize = require("../database");
const clock = require("./clock");
const { sendRecoveryCode, MailDeliveryError } = require("./mailer");
const passwordResetRouter = require("./password-reset");

const app = express();
app.use(express.json());
app.use("/auth", passwordResetRouter);

const SECRET = "test-secret";
const PASSWORD = "secret123";
const NOW = new Date("2026-01-01T00:00:00.000Z");
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const GENERIC_MESSAGE = "If the email exists, a recovery code was sent";
const INVALID_CODE_MESSAGE = "Invalid or expired code";

const forgotPassword = (body) =>
  request(app).post("/auth/forgot-password").send(body);
const verifyResetCode = (body) =>
  request(app).post("/auth/verify-reset-code").send(body);

let user;

beforeEach(() => {
  clock.setClock(() => NOW);
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  PasswordResetCode.create.mockResolvedValue({});
  PasswordResetCode.update.mockResolvedValue([0]);
  user = {
    id: 1,
    username: "juan",
    email: "juan@example.com",
    name: "Juan",
    password: bcrypt.hashSync(PASSWORD, 10),
    role: { name: "customer" },
    save: jest.fn(),
  };
});

afterEach(() => {
  clock.resetClock();
});

describe("POST /auth/forgot-password", () => {
  it("responds 400 when the email is missing", async () => {
    const response = await forgotPassword({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "email is required" });
  });

  it("responds 422 when the email is invalid", async () => {
    const response = await forgotPassword({ email: "invalid@" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { email: "Email inválido" } });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("responds 200 with the generic message and no email for unknown users", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await forgotPassword({ email: "nobody@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: GENERIC_MESSAGE });
    expect(sendRecoveryCode).not.toHaveBeenCalled();
    expect(PasswordResetCode.create).not.toHaveBeenCalled();
  });

  it("stores a hashed code and sends it by email for registered users", async () => {
    User.findOne.mockResolvedValue(user);
    PasswordResetCode.findOne.mockResolvedValue(null);

    const response = await forgotPassword({ email: "juan@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: GENERIC_MESSAGE });
    expect(sendRecoveryCode).toHaveBeenCalledTimes(1);

    const [email, code] = sendRecoveryCode.mock.calls[0];
    expect(email).toBe("juan@example.com");
    expect(code).toMatch(/^\d{8}$/);

    const [values, options] = PasswordResetCode.create.mock.calls[0];
    expect(values.userId).toBe(1);
    expect(values.codeHash).not.toBe(code);
    expect(values.expiresAt).toEqual(new Date(NOW.getTime() + 5 * 60 * 1000));
    expect(options).toEqual({ transaction: TRANSACTION });
    await expect(bcrypt.compare(code, values.codeHash)).resolves.toBe(true);
    expect(PasswordResetCode.update).toHaveBeenCalledWith(
      { consumedAt: NOW },
      { where: { userId: 1, consumedAt: null }, transaction: TRANSACTION },
    );
    expect(JSON.stringify(response.body)).not.toContain(code);
  });

  it("responds 429 without sending an email during the cooldown window", async () => {
    User.findOne.mockResolvedValue(user);
    PasswordResetCode.findOne.mockResolvedValue({
      createdAt: new Date(NOW.getTime() - 60 * 1000),
    });

    const response = await forgotPassword({ email: "juan@example.com" });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      message: "Please wait before requesting a new code",
    });
    expect(PasswordResetCode.create).not.toHaveBeenCalled();
    expect(sendRecoveryCode).not.toHaveBeenCalled();
  });

  it("responds 502 when the email cannot be sent", async () => {
    User.findOne.mockResolvedValue(user);
    PasswordResetCode.findOne.mockResolvedValue(null);
    sendRecoveryCode.mockRejectedValueOnce(new MailDeliveryError("smtp down"));

    const response = await forgotPassword({ email: "juan@example.com" });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      message: "Could not send the recovery email",
    });
  });

  it("propagates unexpected errors as a server error", async () => {
    User.findOne.mockResolvedValue(user);
    PasswordResetCode.findOne.mockRejectedValue(new Error("db down"));

    const response = await forgotPassword({ email: "juan@example.com" });

    expect(response.status).toBe(500);
  });
});

describe("POST /auth/verify-reset-code", () => {
  it("responds 400 when a required field is missing", async () => {
    const response = await verifyResetCode({ email: "juan@example.com" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "email and code are required" });
  });

  it("responds 422 when the code does not have 8 digits", async () => {
    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "1234",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { code: "El código debe tener 8 dígitos" },
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("responds 401 when the user does not exist", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await verifyResetCode({
      email: "nobody@example.com",
      code: "00427193",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: INVALID_CODE_MESSAGE });
  });

  it("responds 401 when there is no pending code", async () => {
    User.findOne.mockResolvedValue(user);
    PasswordResetCode.findOne.mockResolvedValue(null);

    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "00427193",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: INVALID_CODE_MESSAGE });
  });

  it("responds 401 when the code is expired", async () => {
    User.findOne.mockResolvedValue(user);
    const save = jest.fn();
    PasswordResetCode.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      codeHash: bcrypt.hashSync("00427193", 10),
      expiresAt: new Date(NOW.getTime() - 1000),
      consumedAt: null,
      save,
    });

    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "00427193",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: INVALID_CODE_MESSAGE });
    expect(save).not.toHaveBeenCalled();
  });

  it("responds 401 when the code does not match the stored hash", async () => {
    User.findOne.mockResolvedValue(user);
    const save = jest.fn();
    PasswordResetCode.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      codeHash: bcrypt.hashSync("00427193", 10),
      expiresAt: new Date(NOW.getTime() + 60 * 1000),
      consumedAt: null,
      save,
    });

    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "99999999",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: INVALID_CODE_MESSAGE });
    expect(save).not.toHaveBeenCalled();
  });

  it("responds 200 with a JWT and consumes the code when it is valid", async () => {
    User.findOne.mockResolvedValue(user);
    const save = jest.fn();
    PasswordResetCode.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      codeHash: bcrypt.hashSync("00427193", 10),
      expiresAt: new Date(NOW.getTime() + 60 * 1000),
      consumedAt: null,
      save,
    });

    const response = await verifyResetCode({
      email: "juan@example.com",
      code: "00427193",
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 1,
      username: "juan",
      email: "juan@example.com",
      name: "Juan",
      role: "customer",
    });
    expect(response.body.user).not.toHaveProperty("password");
    expect(save).toHaveBeenCalledWith({ transaction: TRANSACTION });

    const decoded = jwt.verify(response.body.token, SECRET, {
      algorithms: ["HS256"],
    });
    expect(decoded.sub).toBe(1);
    expect(decoded.role).toBe("customer");
  });
});
