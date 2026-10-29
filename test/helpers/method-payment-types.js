const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Currency = require("../../src/models/currency");
const MethodPaymentType = require("../../src/models/method-payment-type");

const PASSWORD = "secret123";
const FIELD = Object.freeze({
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
});
const CURRENCY = Object.freeze({
  name: "Dólar de prueba",
  symbol: "$",
  rate: "900.000000",
  is_base: false,
  is_active: true,
});
const METHOD_PAYMENT_TYPE = Object.freeze({
  name: "PayPal",
  fields: [FIELD],
  description: "Pagos por PayPal",
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
function uniqueCurrencyCode() {
  return `M${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

/**
 * Generates a unique uppercase payment type code.
 * @param {string} [prefix] - Optional prefix.
 * @returns {string} The generated code.
 */
function uniqueCode(prefix = "T") {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`
    .toUpperCase()
    .slice(0, 30);
}

/**
 * Creates a currency directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created currency.
 */
function createCurrency(overrides = {}) {
  return Currency.create({
    ...CURRENCY,
    code: uniqueCurrencyCode(),
    ...overrides,
  });
}

/**
 * Creates a payment type directly in the database.
 * @param {object} overrides - Attributes, including currency_id.
 * @returns {Promise<object>} The created instance.
 */
function createMethodPaymentType(overrides) {
  return MethodPaymentType.create({
    ...METHOD_PAYMENT_TYPE,
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
 * Truncates the tables used by the method payment type suites. Currencies are
 * left alone because other suites manage them; the helper creates the
 * currencies it needs with unique codes.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await MethodPaymentType.destroy({
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
  FIELD,
  METHOD_PAYMENT_TYPE,
  PASSWORD,
  USERS,
  as,
  createCurrency,
  createMethodPaymentType,
  getRoleId,
  resetDatabase,
  tokenFor,
  uniqueCode,
  uniqueCurrencyCode,
};
