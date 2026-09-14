process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const PasswordResetCode = require("../models/password-reset-code");
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

describe("DELETE /users/:id with a real database", () => {
  it("deletes the user and responds 204 without a body", async () => {
    await createUser(ADMIN);
    const seller = await createUser(SELLER);
    const token = await tokenFor("admin");

    const response = await asAdmin("delete", `/users/${seller.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(User.findByPk(seller.id)).resolves.toBeNull();
  });

  it("deletes the pending password reset codes in cascade", async () => {
    await createUser(ADMIN);
    const seller = await createUser(SELLER);
    await PasswordResetCode.create({
      userId: seller.id,
      codeHash: "hash",
      expiresAt: new Date(Date.now() + 60 * 1000),
    });
    const token = await tokenFor("admin");

    const response = await asAdmin("delete", `/users/${seller.id}`, token);

    expect(response.status).toBe(204);
    await expect(
      PasswordResetCode.count({ where: { userId: seller.id } }),
    ).resolves.toBe(0);
  });

  it("responds 404 for an unknown user", async () => {
    await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("delete", "/users/99999", token);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "User not found" });
  });

  it("responds 422 when the id is invalid", async () => {
    await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("delete", "/users/abc", token);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid user id" } });
  });

  it("responds 409 when the administrator deletes itself", async () => {
    const admin = await createUser(ADMIN);
    const token = await tokenFor("admin");

    const response = await asAdmin("delete", `/users/${admin.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "You cannot delete your own account",
    });
  });

  it("responds 403 for a non-administrator", async () => {
    await createUser(ADMIN);
    const seller = await createUser(SELLER);
    const token = await tokenFor("maria");

    const response = await asAdmin("delete", `/users/${seller.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).delete("/users/1");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
