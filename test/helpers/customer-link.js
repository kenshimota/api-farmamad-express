const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");

const PASSWORD = "secret123";
const ADMIN = {
  username: "admin",
  email: "admin@superking.com",
  name: "Administrador",
  role: "admin",
};
const CUSTOMER_USER = {
  username: "cliente",
  email: "cliente@example.com",
  name: "Cliente Demo",
  role: "customer",
};
const CUSTOMER_BODY = {
  fullName: "Cliente Demo",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "cliente@example.com",
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
 * Creates a customer in the test database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createCustomer(overrides = {}) {
  return Customer.create({ ...CUSTOMER_BODY, ...overrides });
}

/**
 * Creates the administrator and returns a valid JWT.
 * @returns {Promise<string>} The signed token.
 */
async function adminToken() {
  await createUser(ADMIN);
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: ADMIN.username, password: PASSWORD });

  return response.body.token;
}

/**
 * Creates a user and returns a valid JWT.
 * @param {object} user - User attributes with a `role` name.
 * @returns {Promise<string>} The signed token.
 */
async function tokenFor(user) {
  await createUser(user);
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: user.username, password: PASSWORD });

  return response.body.token;
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string} token - Bearer token.
 * @returns {import("supertest").Test} The supertest request.
 */
function as(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

/**
 * Truncates the users and customers tables of the test database.
 * @returns {Promise<void>} Resolves once both tables are empty.
 */
async function resetDatabase() {
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Customer.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  ADMIN,
  CUSTOMER_BODY,
  CUSTOMER_USER,
  PASSWORD,
  adminToken,
  as,
  createCustomer,
  createUser,
  resetDatabase,
  tokenFor,
};
