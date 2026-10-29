const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Currency = require("../../src/models/currency");
const CurrencyRateHistory = require("../../src/models/currency-rate-history");
const MethodPaymentType = require("../../src/models/method-payment-type");

const PASSWORD = "secret123";
const CURRENCY = Object.freeze({
  code: "EUR",
  name: "Euro",
  symbol: "€",
  rate: "970.500000",
  is_base: false,
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
 * Generates a unique uppercase currency code.
 * @returns {string} The generated code.
 */
function uniqueCode() {
  return `C${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

/**
 * Creates a currency directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createCurrency(overrides = {}) {
  return Currency.create({
    ...CURRENCY,
    code: uniqueCode(),
    ...overrides,
  });
}

/**
 * Creates a rate history row directly in the database.
 * @param {number} currencyId - Currency id.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createHistory(currencyId, overrides = {}) {
  return CurrencyRateHistory.create({
    currency_id: currencyId,
    previous_rate: null,
    new_rate: "970.500000",
    changed_by: null,
    changed_at: new Date("2026-10-29T12:00:00.000Z"),
    reason: "seed",
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
 * Truncates every table used by the currencies suites. Method payment types,
 * history and currencies go first so the restrictive foreign keys never block
 * the cleanup.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  // HU-28 keeps a RESTRICT foreign key from method_payment_types to currencies.
  await MethodPaymentType.destroy({ where: {} });
  await CurrencyRateHistory.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Currency.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  CURRENCY,
  PASSWORD,
  USERS,
  as,
  createCurrency,
  createHistory,
  getRoleId,
  resetDatabase,
  tokenFor,
  uniqueCode,
};
