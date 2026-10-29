process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  ensureDefaultTransactionCurrency,
  publicCurrencySummary,
} = require("../../test/helpers/currency-default");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
const {
  as,
  createPurchase,
  createPurchaseSupplier,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/purchases");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

/**
 * Creates the supplier, product and sellable state used by a purchase.
 * @returns {Promise<object>} The references.
 */
async function references() {
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    supplier: await createPurchaseSupplier(),
    product: await createProduct({ reference: `CUR-${suffix}` }),
    sellable: await createItemState({
      name: `state_${suffix}`,
      label: `Estado ${suffix}`,
      is_sellable: true,
    }),
  };
}

/**
 * Creates a unique active currency.
 * @returns {Promise<object>} The stored currency.
 */
function createCurrency() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return Currency.create({
    code: `CUR${suffix}`,
    name: "Moneda de prueba",
    symbol: "M",
    rate: "10.000000",
    is_base: false,
    is_active: true,
  });
}

/**
 * Builds one purchase line.
 * @param {object} refs - References.
 * @returns {object} Purchase line.
 */
function line(refs) {
  return {
    product_id: refs.product.id,
    item_state_id: refs.sellable.id,
    quantity: 2,
    unit_cost: 10,
  };
}

describe("currency integration in purchases", () => {
  it("accepts an explicit active currency and filters by currency_id", async () => {
    const refs = await references();
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const created = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      currency_id: currency.id,
      items: [line(refs)],
    });

    expect(created.status).toBe(201);
    expect(created.body.currency_id).toBe(currency.id);
    expect(created.body.currency).toEqual(publicCurrencySummary(currency));

    const list = await as(
      "get",
      `/purchases?currency_id=${currency.id}`,
      token,
    );
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it("ignores currency_id sent inside a purchase line", async () => {
    const refs = await references();
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const response = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      items: [{ ...line(refs), currency_id: currency.id }],
    });

    expect(response.status).toBe(201);
    expect(response.body.items[0]).not.toHaveProperty("currency_id");
  });

  it("rejects an invalid currency", async () => {
    const refs = await references();
    const token = await tokenFor("admin");

    const response = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      currency_id: 999999,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
  });

  it("changes the currency only while the purchase is a draft", async () => {
    const refs = await references();
    const defaultCurrency = await ensureDefaultTransactionCurrency();
    const other = await createCurrency();
    const token = await tokenFor("admin");
    const draft = await createPurchase({ supplier_id: refs.supplier.id });

    const updated = await as("put", `/purchases/${draft.id}`, token).send({
      currency_id: other.id,
    });
    expect(updated.status).toBe(202);
    expect(updated.body.currency_id).toBe(other.id);
    expect(updated.body.total).toBe(0);

    const confirmed = await createPurchase({
      supplier_id: refs.supplier.id,
      status: "confirmed",
      currency_id: defaultCurrency.id,
    });
    const rejected = await as("put", `/purchases/${confirmed.id}`, token).send({
      currency_id: other.id,
    });
    expect(rejected.status).toBe(409);
    expect(rejected.body).toEqual({ message: "Purchase is not editable" });
  });

  it("confirms a purchase whose currency was deactivated afterwards", async () => {
    const refs = await references();
    const currency = await createCurrency();
    const token = await tokenFor("admin");
    const created = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      currency_id: currency.id,
      items: [line(refs)],
    });

    await currency.update({ is_active: false });
    const confirmed = await as(
      "post",
      `/purchases/${created.body.id}/confirm`,
      token,
    );

    expect(confirmed.status).toBe(200);
    const cost = await Cost.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.sellable.id,
      },
    });
    expect(cost.currency_id).toBe(currency.id);
  });

  it("copies the purchase currency to the cost on confirmation", async () => {
    const refs = await references();
    const currency = await createCurrency();
    const token = await tokenFor("admin");

    const created = await as("post", "/purchases", token).send({
      supplier_id: refs.supplier.id,
      currency_id: currency.id,
      items: [line(refs)],
    });

    const confirmed = await as(
      "post",
      `/purchases/${created.body.id}/confirm`,
      token,
    );
    expect(confirmed.status).toBe(200);

    const cost = await Cost.findOne({
      where: {
        product_id: refs.product.id,
        item_state_id: refs.sellable.id,
      },
    });
    expect(cost.currency_id).toBe(currency.id);
    expect(Number(cost.cost)).toBe(10);
  });
});
