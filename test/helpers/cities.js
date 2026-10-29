const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const State = require("../../src/models/state");
const City = require("../../src/models/city");

const PASSWORD = "secret123";
const STATE_BODY = { name: "Aragua", code: "VE-D" };
const BODY = { name: "Maracay" };
const PUBLIC_CITY = {
  id: expect.any(Number),
  name: "Maracay",
  state_id: expect.any(Number),
};
const USERS = {
  admin: { username: "admin", email: "admin@superking.com", name: "Admin" },
  seller: { username: "maria", email: "maria@superking.com", name: "María" },
  dispatcher: {
    username: "pedro",
    email: "pedro@superking.com",
    name: "Pedro",
  },
  manager_warehouse: {
    username: "luis",
    email: "luis@superking.com",
    name: "Luis",
  },
  support: {
    username: "sofia",
    email: "sofia@superking.com",
    name: "Sofía",
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
 * Creates a state directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createState(overrides = {}) {
  return State.create({ ...STATE_BODY, ...overrides });
}

/**
 * Creates a city directly in the database. When `state_id` is omitted it
 * creates the default Aragua state first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createCity(overrides = {}) {
  const values = { ...BODY, ...overrides };

  if (values.state_id === undefined) {
    const state = await createState();

    values.state_id = state.id;
  }

  return City.create(values);
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
 * Truncates the cities, states and users tables of the test database. Cities
 * go first so the restrictive foreign key never blocks the cleanup.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await City.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await State.destroy({
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
  STATE_BODY,
  PUBLIC_CITY,
  as,
  createCity,
  createState,
  resetDatabase,
  tokenFor,
};
