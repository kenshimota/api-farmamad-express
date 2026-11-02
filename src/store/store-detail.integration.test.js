process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  ensureDefaultTransactionCurrency,
  publicCurrencySummary,
} = require("../../test/helpers/currency-default");
const { createCategory, createImage } = require("../../test/helpers/products");
const {
  as,
  createCustomer,
  createCustomerUser,
  createPriceList,
  createStoreCost,
  createStoreItemState,
  createStoreLocation,
  createStoreLot,
  createStoreProduct,
  createStoreStock,
  resetStoreDatabase,
  suffix,
} = require("../../test/helpers/store");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetStoreDatabase();
});

afterAll(async () => {
  await resetStoreDatabase();
  await sequelize.close();
});

/**
 * Creates a customer with a price list and a linked customer user.
 * @returns {Promise<{ customer: object, priceList: object, token: string }>}
 *   The fixture.
 */
async function setupCustomer() {
  const priceList = await createPriceList();
  const customer = await createCustomer({ price_list_id: priceList.id });
  const { token } = await createCustomerUser(customer);

  return { customer, priceList, token };
}

/**
 * Adds a variant of an existing product.
 * @param {object} product - Product instance.
 * @param {object} location - Location rows.
 * @param {object} [options] - Variant options.
 * @returns {Promise<object>} The item state and cost.
 */
async function addVariant(
  product,
  location,
  { itemState, cost = 10, stock = 10, reserved = 0, withLot = true } = {},
) {
  const state = await createStoreItemState(itemState);
  const references = { product, itemState: state, ...location };

  await createStoreCost(references, { cost });
  await createStoreStock(references, stock);

  if (withLot) {
    await createStoreLot(references, { stock, reserved });
  }

  return { itemState: state, references };
}

describe("GET /store/products/:id with a real database", () => {
  it("returns every priced variant and marks exhausted ones unavailable", async () => {
    const { token } = await setupCustomer();
    const currency = await ensureDefaultTransactionCurrency();
    const category = await createCategory({ name: "Analgésicos" });
    const image = await createImage({
      reference: `detalle-${suffix()}`,
      pathname: null,
    });
    const product = await createStoreProduct({
      name: "Ibuprofeno 400 mg",
      description: "Analgésico y antiinflamatorio",
      reference: `DET-${suffix()}`,
      category_id: category.id,
      image_id: image.id,
    });
    const location = await createStoreLocation();
    const available = await addVariant(product, location, {
      itemState: { name: "sellable", label: "Vendible" },
      cost: 10,
      stock: 10,
      reserved: 2,
    });
    const exhausted = await addVariant(product, location, {
      itemState: { name: "intact", label: "Intacto" },
      cost: 20,
      stock: 5,
      reserved: 5,
    });

    const response = await as("get", `/store/products/${product.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: product.id,
      name: "Ibuprofeno 400 mg",
      description: "Analgésico y antiinflamatorio",
      reference: product.reference,
      category_id: category.id,
      image_id: image.id,
      category: { id: category.id, name: "Analgésicos" },
      image: {
        id: image.id,
        url: image.url,
        pathname: null,
        reference: image.reference,
        thumbnail: image.thumbnail,
      },
      variants: [
        {
          item_state: {
            id: available.itemState.id,
            name: "sellable",
            label: "Vendible",
          },
          price: 14.29,
          currency_id: currency.id,
          currency: publicCurrencySummary(currency),
          available: true,
        },
        {
          item_state: {
            id: exhausted.itemState.id,
            name: "intact",
            label: "Intacto",
          },
          price: 28.57,
          currency_id: currency.id,
          currency: publicCurrencySummary(currency),
          available: false,
        },
      ],
    });
    expect(response.body).not.toHaveProperty("sale_price");
    expect(response.body.variants[0]).not.toHaveProperty("quantity");
  });

  it("filters the variants by item_state_id", async () => {
    const { token } = await setupCustomer();
    const product = await createStoreProduct();
    const location = await createStoreLocation();
    await addVariant(product, location, {
      itemState: { name: "sellable", label: "Vendible" },
      cost: 10,
    });
    const second = await addVariant(product, location, {
      itemState: { name: "intact", label: "Intacto" },
      cost: 20,
    });

    const response = await as(
      "get",
      `/store/products/${product.id}?item_state_id=${second.itemState.id}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.variants).toHaveLength(1);
    expect(response.body.variants[0].item_state.id).toBe(second.itemState.id);
    expect(response.body.variants[0].price).toBe(28.57);
  });

  it("marks a variant without lots as unavailable", async () => {
    const { token } = await setupCustomer();
    const product = await createStoreProduct();
    const location = await createStoreLocation();
    await addVariant(product, location, { withLot: false });

    const response = await as("get", `/store/products/${product.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body.variants).toHaveLength(1);
    expect(response.body.variants[0].available).toBe(false);
  });

  it("answers 404 for an unknown product or one without priced variants", async () => {
    const { token } = await setupCustomer();
    const missing = await as("get", "/store/products/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Product not found" });

    const product = await createStoreProduct();
    const state = await createStoreItemState();
    const location = await createStoreLocation();
    const references = { product, itemState: state, ...location };
    await createStoreStock(references, 0);
    const unpriced = await as("get", `/store/products/${product.id}`, token);
    expect(unpriced.status).toBe(404);
    expect(unpriced.body).toEqual({ message: "Product not found" });
  });

  it("answers 404 when the filtered state has no cost", async () => {
    const { token } = await setupCustomer();
    const product = await createStoreProduct();
    const location = await createStoreLocation();
    await addVariant(product, location, {
      itemState: { name: "sellable", label: "Vendible" },
    });
    const uncosted = await createStoreItemState({
      name: "intact",
      label: "Intacto",
    });

    const response = await as(
      "get",
      `/store/products/${product.id}?item_state_id=${uncosted.id}`,
      token,
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Product not found" });
  });

  it("rejects invalid ids and non-sellable item states", async () => {
    const { token } = await setupCustomer();

    const invalidId = await as("get", "/store/products/abc", token);
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({ errors: { id: "Invalid product id" } });

    const invalidStateFormat = await as(
      "get",
      "/store/products/15?item_state_id=abc",
      token,
    );
    expect(invalidStateFormat.status).toBe(422);
    expect(invalidStateFormat.body).toEqual({
      errors: { item_state_id: "Invalid item state id" },
    });

    const hidden = await createStoreItemState({ is_sellable: false });
    const notSellable = await as(
      "get",
      `/store/products/15?item_state_id=${hidden.id}`,
      token,
    );
    expect(notSellable.status).toBe(422);
    expect(notSellable.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
  });
});
