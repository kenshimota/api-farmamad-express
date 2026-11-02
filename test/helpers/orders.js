const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Customer = require("../../src/models/customer");
const PriceList = require("../../src/models/price-list");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const Cost = require("../../src/models/cost");
const Stock = require("../../src/models/stock");
const Lot = require("../../src/models/lot");
const Warehouse = require("../../src/models/warehouse");
const Shelf = require("../../src/models/shelf");
const ShelfSection = require("../../src/models/shelf-section");
const Order = require("../../src/models/order");
const OrderItem = require("../../src/models/order-item");
const OrderItemLotAllocation = require("../../src/models/order-item-lot-allocation");
const OrderHistory = require("../../src/models/order-history");
const { ensureDefaultTransactionCurrency } = require("./currency-default");
const { ensureStandardPaymentTerms } = require("./payment-terms");
const catalog = require("./order-catalog");

const PASSWORD = "secret123";
const USERS = Object.freeze({
  admin: { username: "admin", email: "admin@farmamad.com", name: "Admin" },
  seller: { username: "maria", email: "maria@farmamad.com", name: "María" },
  dispatcher: { username: "pedro", email: "pedro@farmamad.com", name: "Pedro" },
  manager_warehouse: {
    username: "luis",
    email: "luis@farmamad.com",
    name: "Luis",
  },
  support: { username: "sofia", email: "sofia@farmamad.com", name: "Sofía" },
  customer: { username: "ana", email: "ana@farmamad.com", name: "Ana" },
});

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
 * Creates a user with the given role.
 * @param {string} role - Seeded role name.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created user.
 */
async function createUser(role, overrides = {}) {
  const base = USERS[role] ?? {
    username: catalog.unique("u"),
    email: `${catalog.unique("e")}@x.com`,
  };

  return User.create({
    username: base.username,
    email: base.email,
    name: base.name,
    password: PASSWORD,
    roleId: await getRoleId(role),
    ...overrides,
  });
}

/**
 * Logs a user in and returns the Bearer token.
 * @param {object} user - Stored user.
 * @returns {Promise<string>} The signed token.
 */
async function login(user) {
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: user.username, password: PASSWORD });

  return response.body.token;
}

/**
 * Creates a user of any role and returns its token.
 * @param {string} role - Seeded role name.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<{ user: object, token: string }>} The created session.
 */
async function sessionFor(role, overrides = {}) {
  const user = await createUser(role, overrides);

  return { user, token: await login(user) };
}

/**
 * Creates a customer with unique contact data.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created customer.
 */
function createCustomer(overrides = {}) {
  const suffix = catalog.unique("C");

  return Customer.create({
    fullName: `Cliente ${suffix}`,
    latitude: -17.7833,
    longitude: -63.1821,
    direction: "Av. Monseñor Rivero 123",
    email: `cliente-${suffix.toLowerCase()}@example.com`,
    isRegistered: false,
    ...overrides,
  });
}

/**
 * Creates a price list.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created price list.
 */
function createPriceList(overrides = {}) {
  return PriceList.create({
    name: catalog.unique("Lista"),
    description: null,
    percentage: "30.00",
    ...overrides,
  });
}

/**
 * Creates a customer user linked to a customer with its own price list.
 * @param {object} [options] - Fixture options.
 * @param {string} [options.percentage] - Price list margin.
 * @param {string} [options.direction] - Customer address.
 * @returns {Promise<object>} Customer, user, price list and token.
 */
async function linkedCustomerSession({
  percentage = "30.00",
  direction = "Av. Monseñor Rivero 123",
} = {}) {
  const priceList = await createPriceList({ percentage });
  const customer = await createCustomer({
    price_list_id: priceList.id,
    direction,
  });
  const suffix = catalog.unique("U");
  const { user, token } = await sessionFor("customer", {
    customer_id: customer.id,
    username: `cliente_${suffix}`.slice(0, 50),
    email: `cliente-${suffix.toLowerCase()}@example.com`,
  });

  return { customer, user, priceList, token };
}

/**
 * Builds a complete sale fixture.
 * @param {object} [options] - Fixture options.
 * @returns {Promise<object>} Customer session, product, state, cost and location.
 */
async function createSaleFixture(options = {}) {
  const session = await linkedCustomerSession(options.session);
  const itemState = options.itemState ?? (await catalog.createItemState());
  const product = options.product ?? (await catalog.createProduct());
  const cost = await catalog.createCost(product, itemState, options.cost);
  const location = options.location ?? (await catalog.createLocation());

  return { ...session, product, itemState, cost, location };
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
 * Truncates every table used by the orders suites.
 * @returns {Promise<void>} Resolves once the tables are clean.
 */
async function resetDatabase() {
  for (const model of [
    OrderItemLotAllocation,
    OrderHistory,
    OrderItem,
    Order,
    Lot,
    ShelfSection,
    Shelf,
    Warehouse,
    Cost,
    Stock,
    Product,
    Category,
    Image,
    ItemState,
    User,
    Customer,
    PriceList,
  ]) {
    await model.destroy({
      where: {},
      truncate: true,
      cascade: true,
      restartIdentity: true,
    });
  }

  await ensureDefaultTransactionCurrency();
  await ensureStandardPaymentTerms();
}

module.exports = {
  PASSWORD,
  Order,
  OrderHistory,
  OrderItem,
  OrderItemLotAllocation,
  Stock,
  as,
  createCost: catalog.createCost,
  createCurrency: catalog.createCurrency,
  createCustomer,
  createItemState: catalog.createItemState,
  createLocation: catalog.createLocation,
  createLot: catalog.createLot,
  createPriceList,
  createProduct: catalog.createProduct,
  createSaleFixture,
  createStock: catalog.createStock,
  createUser,
  ensureDefaultTransactionCurrency,
  linkedCustomerSession,
  login,
  resetDatabase,
  sessionFor,
  unique: catalog.unique,
};
