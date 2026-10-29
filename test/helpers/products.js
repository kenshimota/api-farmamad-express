const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");

const PASSWORD = "secret123";
const CATEGORY_BODY = { name: "Analgésicos" };
const IMAGE_BODY = {
  url: "https://cdn.farmamad.com/products/ibuprofeno.png",
  pathname: "/uploads/products/ibuprofeno.png",
  reference: "ibuprofeno-400",
  thumbnail: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
};
const BODY = {
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
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
  return Category.create({ ...CATEGORY_BODY, ...overrides });
}

/**
 * Creates an image directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createImage(overrides = {}) {
  return Image.create({ ...IMAGE_BODY, ...overrides });
}

/**
 * Creates a product directly in the database. When the foreign keys are not
 * supplied it creates a category and an image first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createProduct(overrides = {}) {
  const values = { ...BODY, ...overrides };
  const suffix = String(values.reference);

  if (values.category_id === undefined) {
    const category = await createCategory({
      name: `Categoría ${suffix}`.slice(0, 100),
    });
    values.category_id = category.id;
  }

  if (values.image_id === undefined) {
    const image = await createImage({
      reference: `image-${suffix}`.slice(0, 100),
    });
    values.image_id = image.id;
  }

  return Product.create(values);
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
 * Truncates the products, categories, images and users tables of the test
 * database. Products go first so the restrictive foreign keys never block the
 * cleanup.
 * @returns {Promise<void>} Resolves once every table is empty.
 */
async function resetDatabase() {
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
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  PASSWORD,
  BODY,
  CATEGORY_BODY,
  IMAGE_BODY,
  as,
  createCategory,
  createImage,
  createProduct,
  resetDatabase,
  tokenFor,
};
