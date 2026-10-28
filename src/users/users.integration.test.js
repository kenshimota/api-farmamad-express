process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
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

describe("POST /users with a real database", () => {
  const body = {
    username: "maria",
    email: "maria@farmamad.com",
    password: PASSWORD,
    name: "María",
    role: "seller",
  };

  it.each(["seller", "delivery", "freelance_delivery", "customer"])(
    "allows an administrator to create a user with the %s role",
    async (role) => {
      await createUser({
        username: "admin",
        email: "admin@farmamad.com",
        role: "admin",
      });
      const token = await tokenFor("admin");

      const response = await request(app)
        .post("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...body, role });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(Number),
        username: "maria",
        email: "maria@farmamad.com",
        name: "María",
        role,
      });
      expect(response.body).not.toHaveProperty("password");

      const stored = await User.findByPk(response.body.id, {
        include: { model: Role, as: "role" },
      });
      expect(stored.role.name).toBe(role);
    },
  );

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/users").send(body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("responds 403 for a non-administrator user", async () => {
    await createUser({ role: "seller" });
    const token = await tokenFor("juan");

    const response = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 409 when the username or email already exists", async () => {
    await createUser({
      username: "admin",
      email: "admin@farmamad.com",
      role: "admin",
    });
    await createUser();
    const token = await tokenFor("admin");

    const response = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, username: "juan", email: "juan@example.com" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "User already exists" });
  });

  it("responds 422 when the role does not exist", async () => {
    await createUser({
      username: "admin",
      email: "admin@farmamad.com",
      role: "admin",
    });
    const token = await tokenFor("admin");

    const response = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, role: "superadmin" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { role: "Invalid role" } });
  });

  it("responds 400 when required fields are missing", async () => {
    await createUser({
      username: "admin",
      email: "admin@farmamad.com",
      role: "admin",
    });
    const token = await tokenFor("admin");

    const response = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "maria" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "email, password and role are required",
    });
  });
});
