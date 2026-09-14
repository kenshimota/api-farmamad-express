process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";
const ADMIN = {
  username: "admin",
  email: "admin@breadking.com",
  name: "Administrador",
  role: "admin",
};
const SELLER = {
  username: "maria",
  email: "maria@breadking.com",
  name: "María",
  role: "seller",
};

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
 * Logs in and returns the JWT.
 * @param {string} identifier - Username or email.
 * @returns {Promise<string>} The signed token.
 */
async function tokenFor(identifier) {
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier, password: PASSWORD });

  return response.body.token;
}

/**
 * Authenticated request helper.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string} token - Bearer token.
 * @returns {import("supertest").Test} The supertest request.
 */
function asAdmin(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
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

describe("GET /users with a real database", () => {
  it("lists every user ordered by id with isBlocked and no sensitive data", async () => {
    const admin = await createUser(ADMIN);
    const seller = await createUser(SELLER);
    await seller.update({ isBlocked: true });
    const token = await tokenFor("admin");

    const response = await asAdmin("get", "/users", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: admin.id,
        username: "admin",
        email: "admin@breadking.com",
        name: "Administrador",
        role: "admin",
        isBlocked: false,
      },
      {
        id: seller.id,
        username: "maria",
        email: "maria@breadking.com",
        name: "María",
        role: "seller",
        isBlocked: true,
      },
    ]);
    expect(response.body[0]).not.toHaveProperty("password");
    expect(response.body[0]).not.toHaveProperty("roleId");
  });

  it("responds 403 for a non-administrator", async () => {
    await createUser(SELLER);
    const token = await tokenFor("maria");

    const response = await asAdmin("get", "/users", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).get("/users");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});

describe("PATCH /users/:id/status with a real database", () => {
  it("blocks and unblocks a user", async () => {
    await createUser(ADMIN);
    const seller = await createUser(SELLER);
    const token = await tokenFor("admin");

    const blocked = await asAdmin(
      "patch",
      `/users/${seller.id}/status`,
      token,
    ).send({ isBlocked: true });

    expect(blocked.status).toBe(200);
    expect(blocked.body.isBlocked).toBe(true);
    await expect(
      User.findByPk(seller.id).then((user) => user.isBlocked),
    ).resolves.toBe(true);

    const unblocked = await asAdmin(
      "patch",
      `/users/${seller.id}/status`,
      token,
    ).send({ isBlocked: false });

    expect(unblocked.status).toBe(200);
    expect(unblocked.body.isBlocked).toBe(false);
  });

  it("responds 404 for an unknown user", async () => {
    await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("patch", "/users/99999/status", token).send({
      isBlocked: true,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "User not found" });
  });

  it("responds 400 when isBlocked is missing", async () => {
    await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("patch", "/users/1/status", token).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "isBlocked is required" });
  });

  it("responds 422 when isBlocked is not a boolean", async () => {
    await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("patch", "/users/1/status", token).send({
      isBlocked: "true",
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { isBlocked: "isBlocked must be a boolean" },
    });
  });

  it("responds 422 when the id is invalid", async () => {
    await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("patch", "/users/abc/status", token).send({
      isBlocked: true,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid user id" } });
  });

  it("responds 409 when the administrator blocks itself", async () => {
    const admin = await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin(
      "patch",
      `/users/${admin.id}/status`,
      token,
    ).send({ isBlocked: true });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "You cannot block your own account",
    });
  });

  it("responds 403 for a non-administrator", async () => {
    await createUser(ADMIN);
    const seller = await createUser(SELLER);
    const token = await tokenFor("maria");

    const response = await asAdmin(
      "patch",
      `/users/${seller.id}/status`,
      token,
    ).send({ isBlocked: true });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
