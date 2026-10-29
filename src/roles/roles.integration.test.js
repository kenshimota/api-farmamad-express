process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const seeder = require("../../seeders/20260910000001-roles");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";
const SEEDED_ROLES = [
  "admin",
  "customer",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
];

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
 * Requests the role catalog as an administrator.
 * @param {string} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
async function getRoles(token) {
  return request(app).get("/roles").set("Authorization", `Bearer ${token}`);
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

describe("GET /roles with a real database", () => {
  it("lists the seeded role catalog ordered by id with only id and name", async () => {
    await createUser({
      username: "admin",
      email: "admin@superking.com",
      role: "admin",
    });
    const token = await tokenFor("admin");

    const response = await getRoles(token);

    expect(response.status).toBe(200);
    expect(response.body.map((role) => role.name).sort()).toEqual(
      [...SEEDED_ROLES].sort(),
    );

    const ids = response.body.map((role) => role.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));

    for (const role of response.body) {
      expect(Object.keys(role).sort()).toEqual(["id", "name"]);
    }
  });

  it("keeps exactly six unique roles when the seeder runs repeatedly", async () => {
    const queryInterface = sequelize.getQueryInterface();

    await seeder.up(queryInterface);
    await seeder.up(queryInterface);

    const roles = await Role.findAll();
    expect(roles).toHaveLength(6);
    expect(roles.map((role) => role.name).sort()).toEqual(
      [...SEEDED_ROLES].sort(),
    );
  });

  it("returns the names accepted by POST /users", async () => {
    await createUser({
      username: "admin",
      email: "admin@superking.com",
      role: "admin",
    });
    const token = await tokenFor("admin");

    const response = await getRoles(token);

    for (const { name } of response.body) {
      const created = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: `user-${name}`,
          email: `${name}-user@example.com`,
          password: PASSWORD,
          role: name,
        });

      expect(created.status).toBe(201);
      expect(created.body.role).toBe(name);
    }
  });

  it("responds 403 for a non-administrator", async () => {
    await createUser({ role: "seller" });
    const token = await tokenFor("juan");

    const response = await getRoles(token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).get("/roles");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
