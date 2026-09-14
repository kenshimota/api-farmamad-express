process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

jest.mock("./mailer", () => {
  class MailDeliveryError extends Error {}
  return { sendRecoveryCode: jest.fn(), MailDeliveryError };
});

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const PasswordResetCode = require("../models/password-reset-code");
const { sendRecoveryCode } = require("./mailer");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";
const EMAIL = "juan@example.com";
const BLOCKED_MESSAGE = "User is blocked";

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

const login = (password = PASSWORD) =>
  request(app).post("/auth/login").send({ identifier: EMAIL, password });
const forgotPassword = () =>
  request(app).post("/auth/forgot-password").send({ email: EMAIL });
const verifyCode = (code) =>
  request(app).post("/auth/verify-reset-code").send({ email: EMAIL, code });
const me = (token) =>
  request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  sendRecoveryCode.mockReset();
  await User.destroy({
    where: {},
    truncate: { cascade: true },
    restartIdentity: true,
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe("blocked users with a real database", () => {
  it("rejects the login with 403 once the credentials are valid", async () => {
    await createUser({ isBlocked: true });

    const response = await login();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: BLOCKED_MESSAGE });
    expect(response.body).not.toHaveProperty("token");
  });

  it("keeps the invalid credentials response for a wrong password", async () => {
    await createUser({ isBlocked: true });

    const response = await login("wrong-password");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
  });

  it("rejects verify-reset-code without consuming the valid code", async () => {
    const user = await createUser({ isBlocked: true });
    await forgotPassword();
    const code = sendRecoveryCode.mock.calls[0][1];

    const response = await verifyCode(code);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: BLOCKED_MESSAGE });

    const stored = await PasswordResetCode.findOne({
      where: { userId: user.id },
    });
    expect(stored.consumedAt).toBeNull();
  });

  it("revokes a JWT issued before the block on protected endpoints", async () => {
    const user = await createUser();
    const { body } = await login();
    await user.update({ isBlocked: true });

    const response = await me(body.token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: BLOCKED_MESSAGE });
  });

  it("responds 401 when the JWT belongs to a deleted user", async () => {
    const user = await createUser();
    const { body } = await login();
    await user.destroy();

    const response = await me(body.token);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
