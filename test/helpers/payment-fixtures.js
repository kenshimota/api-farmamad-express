const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");
const Currency = require("../../src/models/currency");
const MethodPaymentType = require("../../src/models/method-payment-type");
const MethodPayment = require("../../src/models/method-payment");

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
 * Logs in an existing user and returns its token.
 * @param {object} user - Persisted user.
 * @returns {Promise<{ token: string, user: object }>} The session.
 */
async function sessionFor(user) {
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: user.username, password: PASSWORD });

  return { token: response.body.token, user };
}

/**
 * Resolves the customer session, reusing the user already linked to the
 * customer when the fixture is built twice with the same customer.
 * @param {object} customer - Customer instance.
 * @returns {Promise<{ token: string, user: object }>} The session.
 */
async function tokenForCustomer(customer) {
  const existing = await User.findOne({
    where: { customer_id: customer.id },
  });

  return existing
    ? sessionFor(existing)
    : tokenFor("customer", { customer_id: customer.id });
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
  const customerUser = await tokenForCustomer(customer);
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

module.exports = {
  METHOD,
  PASSWORD,
  TYPE,
  buildFixture,
  createCurrency,
  createCustomer,
  createMethodPayment,
  createMethodPaymentType,
  sessionFor,
  tokenFor,
  tokenForCustomer,
  uniqueSuffix,
};
