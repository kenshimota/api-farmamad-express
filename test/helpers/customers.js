const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");

const PASSWORD = "secret123";
const BODY = {
  fullName: "Juan Pérez",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "juan@example.com",
};
const PUBLIC_CUSTOMER = {
  id: expect.any(Number),
  fullName: "Juan Pérez",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "juan@example.com",
};
const USERS = {
  admin: { username: "admin", email: "admin@superking.com", name: "Admin" },
  seller: { username: "maria", email: "maria@superking.com", name: "María" },
  delivery: { username: "pedro", email: "pedro@superking.com", name: "Pedro" },
  freelance_delivery: {
    username: "luis",
    email: "luis@superking.com",
    name: "Luis",
  },
  customer: { username: "ana", email: "ana@superking.com", name: "Ana" },
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
 * Creates a user with the given role and returns a valid JWT for it.
 * @param {string} role - Role name from the seeded catalog.
 * @returns {Promise<string>} The signed token.
 */
async function tokenFor(role) {
  const { username, email, name } = USERS[role];

  await User.create({
    username,
    email,
    name,
    password: PASSWORD,
    roleId: await getRoleId(role),
  });

  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: username, password: PASSWORD });

  return response.body.token;
}

/**
 * Creates a customer directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createCustomer(overrides = {}) {
  return Customer.create({ ...BODY, ...overrides });
}

/**
 * Authenticated request helper.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string} token - Bearer token.
 * @returns {import("supertest").Test} The supertest request.
 */
function as(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

/**
 * Truncates the customers and users tables of the test database.
 * @returns {Promise<void>} Resolves once both tables are empty.
 */
async function resetDatabase() {
  await Customer.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  PASSWORD,
  BODY,
  PUBLIC_CUSTOMER,
  as,
  createCustomer,
  resetDatabase,
  tokenFor,
};
