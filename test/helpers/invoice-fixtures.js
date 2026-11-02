const { QueryTypes } = require("sequelize");
const sequelize = require("../../src/database");
const Customer = require("../../src/models/customer");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Product = require("../../src/models/product");
const Category = require("../../src/models/category");
const Image = require("../../src/models/image");
const ItemState = require("../../src/models/item-state");
const Invoice = require("../../src/models/invoice");
const InvoiceItem = require("../../src/models/invoice-item");
const { ensureDefaultTransactionCurrency } = require("./currency-default");
const { ensurePaymentTerm } = require("./payment-terms");

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
 * Generates a unique suffix for fixture values.
 * @param {string} [prefix] - Optional prefix.
 * @returns {string} The unique suffix.
 */
function unique(prefix = "INV") {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
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
 * Creates a user with the given role.
 * @param {string} role - Seeded role name.
 * @returns {Promise<object>} The created user.
 */
async function createUser(role) {
  const { username, email, name } = USERS[role];

  return User.create({
    username,
    email,
    name,
    password: PASSWORD,
    roleId: await getRoleId(role),
  });
}

/**
 * Creates a customer fixture with a unique email and direction.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created customer.
 */
function createCustomer(overrides = {}) {
  const suffix = unique("C");

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
 * Creates a product with its own category and image.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created product.
 */
async function createProduct(overrides = {}) {
  const suffix = unique("P");
  const category = await Category.create({ name: `Categoría ${suffix}` });
  const image = await Image.create({
    url: `https://cdn.farmamad.com/products/${suffix}.png`,
    pathname: `/uploads/products/${suffix}.png`,
    reference: `image-${suffix}`,
    thumbnail: `https://cdn.farmamad.com/products/${suffix}-thumb.png`,
  });

  return Product.create({
    name: `Ibuprofeno ${suffix}`,
    description: "Analgésico",
    reference: `REF-${suffix}`,
    category_id: category.id,
    image_id: image.id,
    ...overrides,
  });
}

/**
 * Creates an item state with a unique name.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created item state.
 */
function createItemState(overrides = {}) {
  const suffix = unique("S");

  return ItemState.create({
    name: `state_${suffix}`.slice(0, 50),
    label: `Estado ${suffix}`.slice(0, 100),
    is_sellable: true,
    ...overrides,
  });
}

/**
 * Reserves the next invoice number from PostgreSQL.
 * @returns {Promise<number>} The next ascending number.
 */
async function nextInvoiceNumber() {
  const [row] = await sequelize.query(
    "SELECT nextval('invoices_number_seq') AS \"number\"",
    { type: QueryTypes.SELECT },
  );

  return Number(row.number);
}

/**
 * Creates a complete invoice fixture. Missing customer, user, currency and
 * number are created on demand.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created invoice.
 */
async function createInvoice(overrides = {}) {
  const values = {
    subtotal: 25,
    tax_amount: 0,
    total: 25,
    paid_amount: 0,
    payment_status: "pending",
    issued_at: new Date("2026-11-01T12:00:00.000Z"),
    due_date: "2026-11-16",
    notes: null,
    order_id: null,
    ...overrides,
  };

  if (values.payment_term_id === undefined) {
    values.payment_term_id = (await ensurePaymentTerm("cash")).id;
  }

  if (values.customer_id === undefined) {
    values.customer_id = (await createCustomer()).id;
  }

  if (values.invoiced_by_user_id === undefined) {
    const existing = await User.findOne({
      where: { username: USERS.admin.username },
    });

    values.invoiced_by_user_id = existing
      ? existing.id
      : (await createUser("admin")).id;
  }

  if (values.currency_id === undefined) {
    values.currency_id = (await ensureDefaultTransactionCurrency()).id;
  }

  if (values.number === undefined) {
    values.number = await nextInvoiceNumber();
  }

  return Invoice.create(values);
}

/**
 * Creates one invoice line snapshot. Missing invoice, product and item state
 * are created on demand.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created line.
 */
async function createInvoiceItem(overrides = {}) {
  const values = { quantity: 2, unit_price: 12.5, subtotal: 25, ...overrides };

  if (values.invoice_id === undefined) {
    values.invoice_id = (await createInvoice()).id;
  }

  if (values.product_id === undefined) {
    values.product_id = (await createProduct()).id;
  }

  if (values.item_state_id === undefined) {
    values.item_state_id = (await createItemState()).id;
  }

  if (
    values.product_name === undefined ||
    values.product_reference === undefined
  ) {
    const product = await Product.findByPk(values.product_id);

    values.product_name ??= product
      ? product.name
      : `Product ${values.product_id}`;
    values.product_reference ??= product
      ? product.reference
      : `REF-${values.product_id}`;
  }

  if (values.item_state_name === undefined) {
    const itemState = await ItemState.findByPk(values.item_state_id);

    values.item_state_name = itemState
      ? itemState.name
      : `state_${values.item_state_id}`;
  }

  return InvoiceItem.create(values);
}

module.exports = {
  PASSWORD,
  USERS,
  Invoice,
  InvoiceItem,
  createCustomer,
  createInvoice,
  createInvoiceItem,
  createItemState,
  createProduct,
  createUser,
  nextInvoiceNumber,
  unique,
};
