const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");
const CustomerSeller = require("../../src/models/customer-seller");

const PASSWORD = "secret123";
const CUSTOMER_BODY = {
  fullName: "Juan Pérez",
  latitude: -17.7833,
  longitude: -63.1821,
  direction: "Av. Monseñor Rivero 123",
  email: "juan@example.com",
};
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
 * Generates a short random suffix to keep users and customers unique.
 * @returns {string} The suffix.
 */
function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Creates a user with the given role and logs it in.
 * @param {string} role - Role name from the seeded catalog.
 * @param {object} [overrides] - User attribute overrides.
 * @returns {Promise<{ user: object, token: string }>} The actor.
 */
async function createActor(role, overrides = {}) {
  const base = USERS[role];
  const suffix = overrides.username ? "" : `-${uniqueSuffix()}`;
  const username = overrides.username ?? `${base.username}${suffix}`;
  const user = await User.create({
    username,
    email: overrides.email ?? `${base.username}${suffix}@farmamad.com`,
    name: base.name,
    password: PASSWORD,
    roleId: await getRoleId(role),
    ...overrides,
    username,
  });
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: username, password: PASSWORD });

  return { user, token: response.body.token };
}

/**
 * Creates a user with the given role and returns a JWT for it.
 * @param {string} role - Role name from the seeded catalog.
 * @param {object} [overrides] - User attribute overrides.
 * @returns {Promise<string>} The signed token.
 */
async function tokenFor(role, overrides = {}) {
  const { token } = await createActor(role, overrides);

  return token;
}

/**
 * Creates a customer directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createCustomer(overrides = {}) {
  return Customer.create({ ...CUSTOMER_BODY, ...overrides });
}

/**
 * Creates an assignment directly in the database.
 * @param {object} customer - Customer instance.
 * @param {object} seller - Seller user instance.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created instance.
 */
function createAssignment(customer, seller, overrides = {}) {
  return CustomerSeller.create({
    customer_id: customer.id,
    seller_id: seller.id,
    assigned_at: new Date("2020-01-01T00:00:00.000Z"),
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
 * Truncates every table used by the customer-sellers suites.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await CustomerSeller.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
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
  CUSTOMER_BODY,
  PASSWORD,
  USERS,
  as,
  createActor,
  createAssignment,
  createCustomer,
  getRoleId,
  resetDatabase,
  tokenFor,
};
