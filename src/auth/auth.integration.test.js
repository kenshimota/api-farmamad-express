process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";

/**
 * Creates a user with sensible defaults.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createUser(overrides = {}) {
  return User.create({
    username: "juan",
    email: "juan@example.com",
    name: "Juan",
    password: PASSWORD,
    ...overrides,
  });
}

/**
 * Sends a login request through the real Express app.
 * @param {object} body - Login payload.
 * @returns {Promise<import("supertest").Response>} The HTTP response.
 */
async function login(body) {
  return request(app).post("/auth/login").send(body);
}

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await User.destroy({
    where: {},
    truncate: { cascade: true },
    restartIdentity: true,
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe("test database guardrail", () => {
  it("only allows database names ending in _test", () => {
    expect(() => assertTestDatabase("bread_king")).toThrow(/_test/);
    expect(() => assertTestDatabase("bread_king_test")).not.toThrow();
  });
});

describe("User model with a real database", () => {
  it("persists the password hashed and never in plain text", async () => {
    const created = await createUser();
    const stored = await User.findByPk(created.id);

    expect(stored.getDataValue("password")).not.toBe(PASSWORD);
    await expect(
      bcrypt.compare(PASSWORD, stored.getDataValue("password")),
    ).resolves.toBe(true);
  });

  it("enforces unique usernames", async () => {
    await createUser();

    await expect(
      createUser({ email: "other@example.com" }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
  });

  it("enforces unique emails", async () => {
    await createUser();

    await expect(createUser({ username: "other" })).rejects.toBeInstanceOf(
      UniqueConstraintError,
    );
  });
});

describe("POST /auth/login with a real database", () => {
  it("logs in with an email and returns a valid JWT", async () => {
    const user = await createUser();

    const response = await login({
      identifier: "juan@example.com",
      password: PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: user.id,
      username: "juan",
      email: "juan@example.com",
      name: "Juan",
    });
    expect(response.body.user).not.toHaveProperty("password");

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    expect(decoded.sub).toBe(user.id);
    expect(decoded.username).toBe("juan");
    expect(decoded.email).toBe("juan@example.com");
  });

  it("logs in with a username", async () => {
    await createUser();

    const response = await login({ identifier: "juan", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("responds 401 for a wrong password", async () => {
    await createUser();

    const response = await login({
      identifier: "juan",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
  });

  it("responds 401 for an unknown user", async () => {
    const response = await login({
      identifier: "nobody@example.com",
      password: PASSWORD,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
  });
});

describe("GET /auth/me with a real database", () => {
  it("returns the authenticated user stored in the database", async () => {
    const user = await createUser();
    const { body } = await login({ identifier: "juan", password: PASSWORD });

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${body.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: user.id,
      username: "juan",
      email: "juan@example.com",
      name: "Juan",
    });
    expect(response.body).not.toHaveProperty("password");
  });

  it("responds 401 when the token belongs to a deleted user", async () => {
    const user = await createUser();
    const { body } = await login({ identifier: "juan", password: PASSWORD });
    await user.destroy();

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${body.token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
