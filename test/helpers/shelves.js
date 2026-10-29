const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Warehouse = require("../../src/models/warehouse");
const Shelf = require("../../src/models/shelf");
const ShelfSection = require("../../src/models/shelf-section");

const PASSWORD = "secret123";
const WAREHOUSE = Object.freeze({
  name: "Bodega Central",
  observations: null,
  address: "Av. Monseñor Rivero 123",
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
 * Generates a unique uppercase shelf or section code.
 * @param {string} [prefix] - Optional code prefix.
 * @returns {string} The generated code.
 */
function uniqueCode(prefix = "S") {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

/**
 * Creates a warehouse directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createWarehouse(overrides = {}) {
  return Warehouse.create({ ...WAREHOUSE, ...overrides });
}

/**
 * Creates a shelf directly in the database.
 * @param {number} warehouseId - Parent warehouse id.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createShelf(warehouseId, overrides = {}) {
  return Shelf.create({
    warehouse_id: warehouseId,
    code: uniqueCode(),
    name: null,
    description: null,
    ...overrides,
  });
}

/**
 * Creates a section directly in the database.
 * @param {number} shelfId - Parent shelf id.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createSection(shelfId, overrides = {}) {
  return ShelfSection.create({
    shelf_id: shelfId,
    code: uniqueCode("C"),
    name: null,
    description: null,
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
 * Truncates every table used by the shelves suites.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await ShelfSection.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Shelf.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Warehouse.destroy({
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
  USERS,
  WAREHOUSE,
  as,
  createSection,
  createShelf,
  createWarehouse,
  getRoleId,
  resetDatabase,
  tokenFor,
  uniqueCode,
};
