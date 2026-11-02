const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");
const Currency = require("../../src/models/currency");
const MethodPaymentType = require("../../src/models/method-payment-type");
const MethodPayment = require("../../src/models/method-payment");
const Payment = require("../../src/models/payment");
const CustomerWallet = require("../../src/models/customer-wallet");
const WalletTransaction = require("../../src/models/wallet-transaction");

const PASSWORD = "secret123";
const CUSTOMER = Object.freeze({
  fullName: "Cliente Billetera",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
});
const CURRENCY = Object.freeze({
  name: "Dólar de prueba",
  symbol: "$",
  rate: "900.000000",
  is_base: false,
  is_active: true,
});
const TYPE = Object.freeze({
  name: "Binance de prueba",
  fields: [],
  description: "Pagos por Binance",
  is_active: true,
});
const METHOD = Object.freeze({
  label: "Binance Farmamad",
  details: {},
  is_active: true,
});

let sequence = 0;

/**
 * Generates a unique suffix for fixtures.
 * @returns {string} The suffix.
 */
function uniqueSuffix() {
  sequence += 1;

  return `${Date.now().toString(36)}${sequence}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

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
 * Creates a customer with unique data.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created customer.
 */
function createCustomer(overrides = {}) {
  const suffix = uniqueSuffix();

  return Customer.create({
    ...CUSTOMER,
    fullName: `Cliente ${suffix}`,
    email: `cliente-${suffix}@farmamad.com`,
    ...overrides,
  });
}

/**
 * Generates a unique uppercase currency code.
 * @returns {string} The code.
 */
function uniqueCurrencyCode() {
  return `P${uniqueSuffix().slice(-6)}`.toUpperCase();
}

/**
 * Creates a currency with unique data.
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
 * Creates a payment method type.
 * @param {object} overrides - Attributes, including currency_id.
 * @returns {Promise<object>} The created type.
 */
function createMethodPaymentType(overrides) {
  return MethodPaymentType.create({
    ...TYPE,
    code: `T${uniqueSuffix()}`.toUpperCase().slice(0, 30),
    ...overrides,
  });
}

/**
 * Creates a concrete payment method.
 * @param {object} overrides - Attributes, including method_payment_type_id.
 * @returns {Promise<object>} The created method.
 */
function createMethodPayment(overrides) {
  return MethodPayment.create({
    ...METHOD,
    label: `Metodo ${uniqueSuffix()}`.slice(0, 100),
    ...overrides,
  });
}

/**
 * Creates a user with the given role and returns a valid JWT for it.
 * @param {string} role - Role name.
 * @param {object} [options] - Extra user attributes.
 * @returns {Promise<{ token: string, user: object }>} The token and user.
 */
async function tokenFor(role, options = {}) {
  const suffix = uniqueSuffix();
  const username = `${role}-${suffix}`.slice(0, 60);
  const user = await User.create({
    username,
    email: `${username}@farmamad.com`,
    name: role,
    password: PASSWORD,
    roleId: await getRoleId(role),
    ...options,
  });
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: username, password: PASSWORD });

  return { token: response.body.token, user };
}

/**
 * Builds a customer, currency, method and the staff/customer tokens.
 * @param {object} [options] - Fixture options.
 * @returns {Promise<object>} The fixture.
 */
async function buildFixture(options = {}) {
  const customer = options.customer ?? (await createCustomer());
  const otherCustomer = options.otherCustomer ?? (await createCustomer());
  const currency = options.currency ?? (await createCurrency());
  const type =
    options.type ??
    (await createMethodPaymentType({
      currency_id: currency.id,
      is_active: options.typeActive ?? true,
    }));
  const method =
    options.method ??
    (await createMethodPayment({
      method_payment_type_id: type.id,
      is_active: options.methodActive ?? true,
    }));
  const admin = await tokenFor("admin");
  const seller = await tokenFor("seller");
  const customerUser = await tokenFor("customer", {
    customer_id: customer.id,
  });
  const otherUser = await tokenFor("customer", {
    customer_id: otherCustomer.id,
  });

  return {
    admin,
    adminToken: admin.token,
    currency,
    customer,
    customerToken: customerUser.token,
    customerUser: customerUser.user,
    method,
    otherCustomer,
    otherToken: otherUser.token,
    sellerToken: seller.token,
    type,
  };
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
 * Registers a payment through the API.
 * @param {object} fixture - Fixture returned by buildFixture.
 * @param {object} [overrides] - Payment body overrides.
 * @param {string} [token] - Token to use; seller by default.
 * @returns {Promise<import("supertest").Response>} The response.
 */
function createPayment(fixture, overrides = {}, token = fixture.sellerToken) {
  return as("post", "/payments", token).send({
    customer_id: fixture.customer.id,
    method_payment_id: fixture.method.id,
    amount: 100,
    ...overrides,
  });
}

/**
 * Truncates every table used by the wallet and payment suites.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await WalletTransaction.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Payment.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await CustomerWallet.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await MethodPayment.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await MethodPaymentType.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
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
  PASSWORD,
  as,
  buildFixture,
  createCurrency,
  createCustomer,
  createMethodPayment,
  createMethodPaymentType,
  createPayment,
  resetDatabase,
  tokenFor,
  uniqueSuffix,
};
