const request = require("supertest");
const { QueryTypes } = require("sequelize");
const app = require("../../src/app");
const sequelize = require("../../src/database");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Purchase = require("../../src/models/purchase");
const PurchaseItem = require("../../src/models/purchase-item");
const Supplier = require("../../src/models/supplier");
const City = require("../../src/models/city");
const State = require("../../src/models/state");
const Product = require("../../src/models/product");
const ItemState = require("../../src/models/item-state");
const Cost = require("../../src/models/cost");
const Stock = require("../../src/models/stock");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const { ensureDefaultTransactionCurrency } = require("./currency-default");
const { createSupplier } = require("./suppliers");
const { createProduct } = require("./products");
const { createItemState } = require("./item-states");

const PASSWORD = "secret123";
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
 * Reserves the next number from the purchase sequence.
 * @returns {Promise<number>} The next ascending number.
 */
async function nextPurchaseNumber() {
  const [row] = await sequelize.query(
    "SELECT nextval('purchases_number_seq') AS \"number\"",
    { type: QueryTypes.SELECT },
  );

  return Number(row.number);
}

/**
 * Creates a purchase supplier with its own state and city, so several
 * suppliers can coexist in the same test without unique violations.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created supplier.
 */
async function createPurchaseSupplier(overrides = {}) {
  if (overrides.city_id !== undefined || overrides.state_id !== undefined) {
    return createSupplier(overrides);
  }

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const state = await State.create({
    name: `Estado ${suffix}`,
    code: `T${suffix}`.slice(0, 10),
  });
  const city = await City.create({
    name: `Ciudad ${suffix}`,
    state_id: state.id,
  });

  return createSupplier({
    identification: overrides.identification ?? `J-${suffix}`,
    email: overrides.email ?? `compras-${suffix.toLowerCase()}@example.com`,
    state_id: state.id,
    city_id: city.id,
    ...overrides,
  });
}

/**
 * Creates a purchase directly in the database. When `supplier_id` is omitted
 * it creates a supplier first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createPurchase(overrides = {}) {
  const values = {
    subtotal: 0,
    tax_amount: 0,
    total: 0,
    notes: null,
    status: "draft",
    ...overrides,
  };

  if (values.supplier_id === undefined) {
    const supplier = await createPurchaseSupplier();

    values.supplier_id = supplier.id;
  }

  if (values.number === undefined) {
    values.number = await nextPurchaseNumber();
  }

  if (values.currency_id === undefined) {
    values.currency_id = (await ensureDefaultTransactionCurrency()).id;
  }

  return Purchase.create(values);
}

/**
 * Creates a purchase line directly in the database. Missing references and the
 * purchase itself are created on demand.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createPurchaseItem(overrides = {}) {
  const values = { quantity: 5, unit_cost: 20, tax_amount: 0, ...overrides };

  if (values.purchase_id === undefined) {
    const purchase = await createPurchase();

    values.purchase_id = purchase.id;
  }

  if (values.product_id === undefined) {
    const suffix = Math.random().toString(36).slice(2, 10);
    const product = await createProduct({ reference: `PUR-${suffix}` });

    values.product_id = product.id;
  }

  if (values.item_state_id === undefined) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const itemState = await createItemState({
      name: `state_${suffix}`,
      label: `Estado ${suffix}`,
    });

    values.item_state_id = itemState.id;
  }

  if (values.subtotal === undefined) {
    values.subtotal = values.quantity * values.unit_cost;
  }

  return PurchaseItem.create(values);
}

/**
 * Builds the expected public representation of a purchase line.
 * @param {object} item - Stored purchase line.
 * @returns {object} Public line.
 */
function publicPurchaseItem(item) {
  return {
    id: item.id,
    product_id: item.product_id,
    item_state_id: item.item_state_id,
    quantity: item.quantity,
    unit_cost: Number(item.unit_cost),
    subtotal: Number(item.subtotal),
    tax_amount: Number(item.tax_amount),
    total: Number(item.subtotal) + Number(item.tax_amount),
  };
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
 * Truncates every table used by the purchases suites, restarts the purchase
 * sequence and leaves the database ready for the next test.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await PurchaseItem.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Purchase.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await sequelize.query("ALTER SEQUENCE purchases_number_seq RESTART WITH 1");
  await Stock.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Cost.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Product.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Category.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Image.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await ItemState.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Supplier.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
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
  await ensureDefaultTransactionCurrency();
}

module.exports = {
  PASSWORD,
  USERS,
  as,
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
  ensureDefaultTransactionCurrency,
  nextPurchaseNumber,
  publicPurchaseItem,
  resetDatabase,
  tokenFor,
};
