process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

jest.mock("./mailer", () => {
  class MailDeliveryError extends Error {}
  return { sendRecoveryCode: jest.fn(), MailDeliveryError };
});

const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const PasswordResetCode = require("../models/password-reset-code");
const clock = require("./clock");
const { sendRecoveryCode, MailDeliveryError } = require("./mailer");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { CODE_TTL_MINUTES } = require("./recovery-codes");

const PASSWORD = "secret123";
const NEW_PASSWORD = "nuevaClave123";
const EMAIL = "juan@example.com";
const GENERIC_MESSAGE = "If the email exists, a recovery code was sent";
const INVALID_CODE_MESSAGE = "Invalid or expired code";

/**
 * Resolves a role id from the seeded roles table.
 * @param {string} name - Role name.
 * @returns {Promise<number>} The role primary key.
 */
async function getRoleId(name) {
  const role = await Role.findOne({ where: { name } });

  if (!role) {
    throw new Error(`Role "${name}" is not seeded`);
  }

  return role.id;
}

/**
 * Creates a user with sensible defaults.
 * @param {object} [overrides] - Attribute overrides; `role` accepts a role name.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createUser(overrides = {}) {
  const { role = "customer", ...attributes } = overrides;

  return User.create({
    username: "juan",
    email: EMAIL,
    name: "Juan",
    password: PASSWORD,
    roleId: await getRoleId(role),
    ...attributes,
  });
}

const forgotPassword = (email) =>
  request(app).post("/auth/forgot-password").send({ email });
const verifyCode = (email, code) =>
  request(app).post("/auth/verify-reset-code").send({ email, code });
const resetPassword = (token, body) =>
  request(app)
    .post("/auth/reset-password")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
const login = (password) =>
  request(app).post("/auth/login").send({ identifier: EMAIL, password });
const sentCode = (index = 0) => sendRecoveryCode.mock.calls[index][1];

// Moves the application clock forward to test cooldown and expiry.
function advanceClock(minutes) {
  const offset = minutes * 60 * 1000;
  clock.setClock(() => new Date(Date.now() + offset));
}

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  clock.resetClock();
  sendRecoveryCode.mockReset();
  await PasswordResetCode.destroy({
    where: {},
    truncate: true,
    restartIdentity: true,
  });
  await User.destroy({
    where: {},
    truncate: { cascade: true },
    restartIdentity: true,
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /auth/forgot-password with a real database", () => {
  it("responds 200 with the generic message and no email for unknown users", async () => {
    const response = await forgotPassword("nobody@example.com");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: GENERIC_MESSAGE });
    expect(sendRecoveryCode).not.toHaveBeenCalled();
    expect(await PasswordResetCode.count()).toBe(0);
  });

  it("stores the hashed code and emails the plain 8-digit code", async () => {
    const user = await createUser();

    const response = await forgotPassword(EMAIL);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: GENERIC_MESSAGE });
    expect(sendRecoveryCode).toHaveBeenCalledWith(EMAIL, expect.any(String));

    const code = sentCode();
    expect(code).toMatch(/^\d{8}$/);
    expect(JSON.stringify(response.body)).not.toContain(code);

    const stored = await PasswordResetCode.findOne({
      where: { userId: user.id },
    });
    expect(stored.codeHash).not.toBe(code);
    await expect(bcrypt.compare(code, stored.codeHash)).resolves.toBe(true);
    expect(stored.consumedAt).toBeNull();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + CODE_TTL_MINUTES * 60 * 1000,
    );
  });

  it("responds 429 and does not send a second email during the cooldown", async () => {
    await createUser();
    await forgotPassword(EMAIL);

    const response = await forgotPassword(EMAIL);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      message: "Please wait before requesting a new code",
    });
    expect(sendRecoveryCode).toHaveBeenCalledTimes(1);
    expect(await PasswordResetCode.count()).toBe(1);
  });

  it("issues a new code after the cooldown and invalidates the previous one", async () => {
    await createUser();
    await forgotPassword(EMAIL);
    const firstCode = sentCode();

    advanceClock(3);
    const response = await forgotPassword(EMAIL);

    expect(response.status).toBe(200);
    expect(sendRecoveryCode).toHaveBeenCalledTimes(2);
    expect((await verifyCode(EMAIL, firstCode)).status).toBe(401);
    expect((await verifyCode(EMAIL, sentCode(1))).status).toBe(200);
  });

  it("responds 502 and persists no code when the email fails", async () => {
    const user = await createUser();
    sendRecoveryCode.mockRejectedValueOnce(new MailDeliveryError("smtp down"));

    const response = await forgotPassword(EMAIL);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      message: "Could not send the recovery email",
    });
    expect(await PasswordResetCode.count({ where: { userId: user.id } })).toBe(
      0,
    );
  });
});

describe("POST /auth/verify-reset-code with a real database", () => {
  it("responds 401 for a wrong code and keeps the real one pending", async () => {
    const user = await createUser();
    await forgotPassword(EMAIL);

    const response = await verifyCode(EMAIL, "99999999");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: INVALID_CODE_MESSAGE });
    expect(
      await PasswordResetCode.count({
        where: { userId: user.id, consumedAt: null },
      }),
    ).toBe(1);
  });

  it("responds 401 when the code has expired", async () => {
    await createUser();
    await forgotPassword(EMAIL);
    const code = sentCode();

    advanceClock(CODE_TTL_MINUTES + 1);
    const response = await verifyCode(EMAIL, code);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: INVALID_CODE_MESSAGE });
  });

  it("responds 200 with a JWT, consumes the code and rejects reuse", async () => {
    const user = await createUser();
    await forgotPassword(EMAIL);
    const code = sentCode();

    const response = await verifyCode(EMAIL, code);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: user.id,
      username: "juan",
      email: EMAIL,
      name: "Juan",
      role: "customer",
      isBlocked: false,
    });
    expect(response.body).not.toHaveProperty("password");

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    expect(decoded.sub).toBe(user.id);

    const stored = await PasswordResetCode.findOne({
      where: { userId: user.id },
    });
    expect(stored.consumedAt).not.toBeNull();
    expect((await verifyCode(EMAIL, code)).status).toBe(401);
  });
});

describe("POST /auth/reset-password with a real database", () => {
  const body = {
    password: NEW_PASSWORD,
    passwordConfirmation: NEW_PASSWORD,
  };

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/auth/reset-password").send(body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 422 when the confirmation does not match", async () => {
    await createUser();
    const { body: session } = await login(PASSWORD);

    const response = await resetPassword(session.token, {
      password: NEW_PASSWORD,
      passwordConfirmation: "otraClave123",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { passwordConfirmation: "Passwords do not match" },
    });
  });

  it("changes the password, invalidates pending codes and allows login", async () => {
    const user = await createUser();
    await forgotPassword(EMAIL);
    const { body: verified } = await verifyCode(EMAIL, sentCode());

    advanceClock(3);
    await forgotPassword(EMAIL);
    const pending = sentCode(1);

    const response = await resetPassword(verified.token, body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Password updated" });
    expect(
      await PasswordResetCode.count({
        where: { userId: user.id, consumedAt: null },
      }),
    ).toBe(0);
    expect((await verifyCode(EMAIL, pending)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect((await login(PASSWORD)).status).toBe(401);

    const stored = await User.findByPk(user.id);
    await expect(
      bcrypt.compare(NEW_PASSWORD, stored.getDataValue("password")),
    ).resolves.toBe(true);
  });
});
