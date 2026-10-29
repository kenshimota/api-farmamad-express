const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Stock = require("../../src/models/stock");
const Cost = require("../../src/models/cost");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");

const PASSWORD = "secret123";
const STOCK_BODY = { quantity: 10 };
const PRODUCT_BODY = {
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
};
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
 * Creates a category directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createCategory(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);

  return Category.create({ name: `Categoría ${suffix}`, ...overrides });
}

/**
 * Creates an image directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createImage(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);

  return Image.create({
    url: `https://cdn.farmamad.com/products/${suffix}.png`,
    pathname: `/uploads/products/${suffix}.png`,
    reference: `image-${suffix}`,
    thumbnail: `https://cdn.farmamad.com/products/${suffix}-thumb.png`,
    ...overrides,
  });
}

/**
 * Creates a product directly in the database. When the foreign keys are not
 * supplied it creates a category and an image first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createProduct(overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const values = {
    ...PRODUCT_BODY,
    reference: `STOCK-${suffix}`,
    ...overrides,
  };

  if (values.category_id === undefined) {
    const category = await createCategory();
    values.category_id = category.id;
  }

  if (values.image_id === undefined) {
    const image = await createImage();
    values.image_id = image.id;
  }

  return Product.create(values);
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
 * Creates a stock row directly in the database. When the foreign keys are
 * omitted it creates a product and an item state first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createStock(overrides = {}) {
  const values = { ...STOCK_BODY, ...overrides };

  if (values.product_id === undefined) {
    const product = await createProduct();
    values.product_id = product.id;
  }

  if (values.item_state_id === undefined) {
    const itemState = await createItemState();
    values.item_state_id = itemState.id;
  }

  return Stock.create(values);
}

/**
 * Creates a cost directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createCost(overrides = {}) {
  return Cost.create({ cost: 12.5, ...overrides });
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
 * Truncates every table used by the stocks suites. Stocks and costs go first
 * so the restrictive foreign keys never block the cleanup.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
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
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  PASSWORD,
  STOCK_BODY,
  as,
  createCost,
  createImage,
  createItemState,
  createProduct,
  createStock,
  publicItemState,
  resetDatabase,
  tokenFor,
};
