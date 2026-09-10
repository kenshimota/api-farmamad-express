process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { UniqueConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";

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
    email: "juan@example.com",
    name: "Juan",
    password: PASSWORD,
    roleId: await getRoleId(role),
    ...attributes,
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

  it("persists the assigned role", async () => {
    const created = await createUser({ role: "seller" });
    const stored = await User.findByPk(created.id, {
      include: { model: Role, as: "role" },
    });

    expect(stored.role.name).toBe("seller");
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
  it("logs in with an email and returns a valid JWT with the role", async () => {
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
      role: "customer",
    });
    expect(response.body.user).not.toHaveProperty("password");

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    expect(decoded.sub).toBe(user.id);
    expect(decoded.username).toBe("juan");
    expect(decoded.email).toBe("juan@example.com");
    expect(decoded.role).toBe("customer");
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
  it("returns the authenticated user with its role", async () => {
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
      role: "customer",
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

describe("GET /auth/setup-status with a real database", () => {
  it("responds hasAdmin false when there are no administrators", async () => {
    await createUser({ role: "seller" });

    const response = await request(app).get("/auth/setup-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasAdmin: false });
  });

  it("responds hasAdmin true when an administrator exists", async () => {
    await createUser({
      username: "admin",
      email: "admin@example.com",
      role: "admin",
    });

    const response = await request(app).get("/auth/setup-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasAdmin: true });
  });
});

describe("POST /auth/register-admin with a real database", () => {
  const body = {
    username: "admin",
    email: "admin@breadking.com",
    password: PASSWORD,
    name: "Administrador",
  };

  it("registers the initial administrator with the administrator role", async () => {
    const response = await request(app).post("/auth/register-admin").send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      username: "admin",
      email: "admin@breadking.com",
      name: "Administrador",
      role: "admin",
    });
    expect(response.body).not.toHaveProperty("password");

    const stored = await User.findByPk(response.body.id, {
      include: { model: Role, as: "role" },
    });
    expect(stored.role.name).toBe("admin");
    await expect(
      bcrypt.compare(PASSWORD, stored.getDataValue("password")),
    ).resolves.toBe(true);
  });

  it("responds 409 when an administrator already exists", async () => {
    await createUser({
      username: "admin",
      email: "admin@example.com",
      role: "admin",
    });

    const response = await request(app).post("/auth/register-admin").send(body);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Admin already exists" });
  });
});
