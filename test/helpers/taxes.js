const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Tax = require("../../src/models/tax");

const PASSWORD = "secret123";
const TAX = Object.freeze({
  name: "Impuesto al Valor Agregado",
  rate: "16.00",
  description: "IVA general",
  is_active: true,
});
const USERS = {
  admin: { username: "admin", email: "admin@farmamad.com", name: "Admin" },
  seller: { username: "maria", email: "maria@farmamad.com", name: "María" },
  dispatcher: {
    username: "pedro",
    email: "pedro@farmamad.com",
    name: "Pedro",
  },
  manager_warehouse: {
    username: "luis",
    email: "luis@farmamad.com",
    name: "Luis",
  },
  support: {
    username: "sofia",
    email: "sofia@farmamad.com",
    name: "Sofía",
  },
  customer: { username: "ana", email: "ana@farmamad.com", name: "Ana" },
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
 * Generates a unique uppercase tax code.
 * @param {string} [prefix] - Optional code prefix.
 * @returns {string} The generated code.
 */
function uniqueCode(prefix = "T") {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`
    .toUpperCase()
    .slice(0, 20);
}

/**
 * Creates a tax directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createTax(overrides = {}) {
  return Tax.create({
    ...TAX,
    code: uniqueCode(),
    ...overrides,
  });
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
 * Truncates the taxes and users tables of the test database.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await Tax.destroy({
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
  TAX,
  USERS,
  as,
  createTax,
  getRoleId,
  resetDatabase,
  tokenFor,
  uniqueCode,
};
