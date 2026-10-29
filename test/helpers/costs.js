const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Cost = require("../../src/models/cost");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const { createProduct } = require("./products");

const PASSWORD = "secret123";
const BODY = { cost: 12.5 };
const ITEM_STATE_BODY = {
  name: "sellable",
  label: "Vendible",
  is_sellable: true,
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
 * Creates an item state directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createItemState(overrides = {}) {
  return ItemState.create({ ...ITEM_STATE_BODY, ...overrides });
}

/**
 * Builds the expected public representation of an item state.
 * @param {object} itemState - Stored item state.
 * @returns {object} Public item state.
 */
function publicItemState(itemState) {
  return {
    id: itemState.id,
    name: itemState.name,
    label: itemState.label,
    is_sellable: itemState.is_sellable,
  };
}

/**
 * Creates a cost directly in the database. When the foreign keys are omitted
 * it creates a product and an item state first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createCost(overrides = {}) {
  const values = { ...BODY, ...overrides };

  if (values.product_id === undefined) {
    const reference = `COST-${Math.random().toString(36).slice(2, 10)}`;
    const product = await createProduct({ reference });

    values.product_id = product.id;
  }

  if (values.item_state_id === undefined) {
    const itemState = await createItemState();

    values.item_state_id = itemState.id;
  }

  return Cost.create(values);
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
 * Truncates every table used by the costs suites. Costs and products go first
 * so the restrictive foreign keys never block the cleanup.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
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
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  PASSWORD,
  BODY,
  ITEM_STATE_BODY,
  as,
  createCost,
  createItemState,
  createProduct,
  publicItemState,
  resetDatabase,
  tokenFor,
};
