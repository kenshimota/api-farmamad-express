const request = require("supertest");
const app = require("../../src/app");
const sequelize = require("../../src/database");
const Customer = require("../../src/models/customer");
const User = require("../../src/models/user");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const Invoice = require("../../src/models/invoice");
const InvoiceItem = require("../../src/models/invoice-item");
const fixtures = require("./invoice-fixtures");
const { ensureDefaultTransactionCurrency } = require("./currency-default");

const PASSWORD = fixtures.PASSWORD;

/**
 * Creates a user and returns its valid JWT.
 * @param {string} role - Seeded role name.
 * @returns {Promise<{ user: object, token: string }>} Session data.
 */
async function sessionFor(role) {
  const user = await fixtures.createUser(role);
  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: user.username, password: PASSWORD });

  return { user, token: response.body.token };
}

/**
 * Creates a user and returns only its JWT.
 * @param {string} role - Seeded role name.
 * @returns {Promise<string>} The signed token.
 */
async function tokenFor(role) {
  return (await sessionFor(role)).token;
}

/**
 * Deletes every table used by the invoice suites and restarts the numbering.
 * @returns {Promise<void>} Resolves once the tables are clean.
 */
async function resetDatabase() {
  await InvoiceItem.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await Invoice.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await sequelize.query("ALTER SEQUENCE invoices_number_seq RESTART WITH 1");
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
  await Customer.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await ensureDefaultTransactionCurrency();
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

module.exports = {
  ...fixtures,
  PASSWORD,
  as,
  resetDatabase,
  sessionFor,
  tokenFor,
};
