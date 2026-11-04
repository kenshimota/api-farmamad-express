process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Currency = require("../models/currency");
const Tax = require("../models/tax");
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
 * @param {object} [overrides] - Price list overrides.
 * @returns {Promise<object>} The customer, price list and token.
 */
async function setupCustomer(overrides = {}) {
  const priceList = await createPriceList(overrides);
  const customer = await createCustomer({ price_list_id: priceList.id });
  const { token } = await createCustomerUser(customer);

  return { customer, priceList, token };
}

/**
 * Creates a variant with explicit cost, stock and lot values.
 * @param {object} options - Variant options.
 * @returns {Promise<object>} The created references.
 */
async function createManualVariant({
  productData = {},
  itemStateData = {},
  cost = 10,
  stock = 10,
  reserved = 0,
  stockQuantity = stock,
  costCurrencyId,
} = {}) {
  const product = await createStoreProduct(productData);
  const itemState = await createStoreItemState(itemStateData);
  const location = await createStoreLocation();
  const references = { product, itemState, ...location };

  await createStoreCost(references, {
    cost,
    ...(costCurrencyId ? { currency_id: costCurrencyId } : {}),
  });
  await createStoreStock(references, stockQuantity);
  await createStoreLot(references, { stock, reserved });

  return references;
}

describe("GET /store/products with a real database", () => {
  it("returns one entry per sellable product state with the resolved price", async () => {
    const { priceList, token } = await setupCustomer();
    const currency = await ensureDefaultTransactionCurrency();
    const category = await createCategory({ name: "Analgésicos" });
    const image = await createImage({
      reference: `ibuprofeno-${suffix()}`,
      url: "https://cdn.example.com/ibuprofeno.png",
      pathname: null,
      thumbnail: "https://cdn.example.com/ibuprofeno-thumb.png",
    });
    const product = await createStoreProduct({
      name: "Ibuprofeno 400 mg",
      description: "Analgésico y antiinflamatorio",
      reference: `IBU-${suffix()}`,
      category_id: category.id,
      image_id: image.id,
    });
    const first = await createStoreItemState({
      name: "sellable",
      label: "Vendible",
    });
    const second = await createStoreItemState({
      name: "intact",
      label: "Intacto",
    });
    const hidden = await createStoreItemState({
      name: `damaged-${suffix()}`,
      label: "Maltratado",
      is_sellable: false,
    });
    const location = await createStoreLocation();

    for (const [itemState, cost] of [
      [first, 10],
      [second, 20],
      [hidden, 30],
    ]) {
      const references = { product, itemState, ...location };
      await createStoreCost(references, { cost });
      await createStoreStock(references, 10);
      await createStoreLot(references, { stock: 10, reserved: 2 });
    }

    const response = await as("get", "/store/products", token);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((variant) => variant.item_state.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(response.body[0]).toEqual({
      id: product.id,
      name: "Ibuprofeno 400 mg",
      description: "Analgésico y antiinflamatorio",
      reference: product.reference,
      category_id: category.id,
      image_id: image.id,
      item_state: { id: first.id, name: "sellable", label: "Vendible" },
      price: 14.29,
      tax: {
        id: expect.any(Number),
        code: "SIN_IVA",
        name: "Sin IVA",
        rate: 0,
      },
      tax_amount: 0,
      total: 14.29,
      currency_id: currency.id,
      currency: publicCurrencySummary(currency),
      available: true,
      category: { id: category.id, name: "Analgésicos" },
      image: {
        id: image.id,
        url: "https://cdn.example.com/ibuprofeno.png",
        pathname: null,
        reference: image.reference,
        thumbnail: "https://cdn.example.com/ibuprofeno-thumb.png",
      },
    });
    expect(response.body[1].price).toBe(28.57);
    expect(response.body[0]).not.toHaveProperty("sale_price");
    expect(response.body[0]).not.toHaveProperty("quantity");
    expect(response.body[0]).not.toHaveProperty("cost");
    expect(response.body[0]).not.toHaveProperty("lots");
    expect(Number(priceList.percentage)).toBe(30);
  });

  it("adds the tax amount and the final total to each variant", async () => {
    const { token } = await setupCustomer();
    const tax = await Tax.findOne({ where: { code: "IVA" } });
    const variant = await createManualVariant({
      productData: { tax_id: tax.id },
      cost: 10,
    });

    const response = await as("get", "/store/products", token);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: variant.product.id,
      price: 14.29,
      tax: {
        id: tax.id,
        code: "IVA",
        name: "Impuesto al Valor Agregado",
        rate: 16,
      },
      tax_amount: 2.29,
      total: 16.58,
    });
  });

  it("filters by a sellable item_state_id", async () => {
    const { token } = await setupCustomer();
    await createManualVariant({ cost: 10 });
    const second = await createManualVariant({
      itemStateData: { name: "intact", label: "Intacto" },
      cost: 20,
    });

    const response = await as(
      "get",
      `/store/products?item_state_id=${second.itemState.id}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].item_state.id).toBe(second.itemState.id);
    expect(response.body[0].price).toBe(28.57);
    expect(response.body[0].id).toBe(second.product.id);
  });

  it("hides exhausted, unpriced, mismatched and inactive currency variants", async () => {
    const { token } = await setupCustomer();
    await createManualVariant({ stock: 3, reserved: 3 });
    await createManualVariant({ stockQuantity: 9 });
    const productWithoutLot = await createStoreProduct();
    const stateWithoutLot = await createStoreItemState();
    const location = await createStoreLocation();
    const noLot = {
      product: productWithoutLot,
      itemState: stateWithoutLot,
      ...location,
    };
    await createStoreCost(noLot);
    await createStoreStock(noLot, 0);
    const inactive = await Currency.create({
      code: `OFF${suffix()}`,
      name: "Moneda inactiva",
      symbol: "X",
      rate: "1.000000",
      is_active: false,
    });
    await createManualVariant({ costCurrencyId: inactive.id });
    const valid = await createManualVariant();

    const response = await as("get", "/store/products", token);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(valid.product.id);
  });

  it("returns [] when no variant is sellable", async () => {
    const { token } = await setupCustomer();

    const response = await as("get", "/store/products", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("rejects an invalid item_state_id with 422", async () => {
    const { token } = await setupCustomer();

    const invalidFormat = await as(
      "get",
      "/store/products?item_state_id=abc",
      token,
    );
    expect(invalidFormat.status).toBe(422);
    expect(invalidFormat.body).toEqual({
      errors: { item_state_id: "Invalid item state id" },
    });

    const missing = await as(
      "get",
      "/store/products?item_state_id=99999",
      token,
    );
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });

    const hidden = await createStoreItemState({ is_sellable: false });
    const notSellable = await as(
      "get",
      `/store/products?item_state_id=${hidden.id}`,
      token,
    );
    expect(notSellable.status).toBe(422);
    expect(notSellable.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
  });
});
