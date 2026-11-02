const { listCatalog } = require("./list");
const { getProductDetail } = require("./detail");
const { variantKey } = require("./repository");

const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "1.000000",
  is_active: true,
};
const ITEM_STATE = { id: 1, name: "sellable", label: "Vendible" };
const CATEGORY = { id: 2, name: "Analgésicos" };
const IMAGE = {
  id: 7,
  url: "https://cdn.example.com/ibuprofeno.png",
  pathname: null,
  reference: "ibuprofeno-400",
  thumbnail: "https://cdn.example.com/ibuprofeno-thumb.png",
};
const PRODUCT = {
  id: 15,
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 2,
  image_id: 7,
  category: CATEGORY,
  image: IMAGE,
};

/**
 * Builds a cost row with all nested relations already loaded.
 * @param {object} [overrides] - Row overrides.
 * @returns {object} Cost row.
 */
function costRow(overrides = {}) {
  return {
    product_id: PRODUCT.id,
    item_state_id: ITEM_STATE.id,
    cost: "10.00",
    currency_id: CURRENCY.id,
    currency: { ...CURRENCY },
    item_state: { ...ITEM_STATE, is_sellable: true },
    product: { ...PRODUCT },
    ...overrides,
  };
}

/**
 * Builds an availability index with one positive entry by default.
 * @param {object} [overrides] - Availability overrides.
 * @returns {object} Availability map.
 */
function availabilityFor(overrides = {}) {
  return {
    [variantKey(PRODUCT.id, ITEM_STATE.id)]: {
      stock: 10,
      reserved: 2,
      available: true,
      ...overrides,
    },
  };
}

/**
 * Builds the stock quantities map used to validate `stocks.quantity`.
 * @param {number} [quantity] - Quantity.
 * @returns {object} Stock map.
 */
function stocksFor(quantity = 10) {
  return { [variantKey(PRODUCT.id, ITEM_STATE.id)]: quantity };
}

/**
 * Creates a repository double for the catalog logic.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} Repository double.
 */
function repositoryDouble(overrides = {}) {
  return {
    findDefaultCurrency: jest.fn().mockResolvedValue({ ...CURRENCY }),
    findCosts: jest.fn().mockResolvedValue([costRow()]),
    findAvailability: jest.fn().mockResolvedValue(availabilityFor()),
    findStockQuantities: jest.fn().mockResolvedValue(stocksFor()),
    ...overrides,
  };
}

describe("listCatalog", () => {
  it("returns one available variant per product and item state", async () => {
    const repository = repositoryDouble();
    const result = await listCatalog({
      repository,
      priceList: { id: 4, percentage: "30.00" },
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 15,
        price: 14.29,
        currency_id: 3,
        available: true,
        item_state: { id: 1, name: "sellable", label: "Vendible" },
      }),
    ]);
    expect(repository.findCosts).toHaveBeenCalledWith({
      itemStateId: undefined,
    });
    expect(repository.findAvailability).toHaveBeenCalledTimes(1);
    expect(repository.findStockQuantities).toHaveBeenCalledTimes(1);
  });

  it("hides exhausted variants and rows whose stock does not match lots", async () => {
    const repository = repositoryDouble({
      findAvailability: jest.fn().mockResolvedValue({
        [variantKey(15, 1)]: { stock: 10, reserved: 8, available: true },
        [variantKey(16, 1)]: { stock: 7, reserved: 7, available: false },
      }),
    });
    repository.findCosts.mockResolvedValue([
      costRow(),
      costRow({ product_id: 16, product: { ...PRODUCT, id: 16 } }),
    ]);
    repository.findStockQuantities.mockResolvedValue({
      [variantKey(15, 1)]: 9,
      [variantKey(16, 1)]: 7,
    });

    const result = await listCatalog({
      repository,
      priceList: { id: 4, percentage: "30.00" },
    });

    expect(result).toEqual([]);
  });

  it("omits variants whose cost currency is not usable", async () => {
    const repository = repositoryDouble({
      findCosts: jest
        .fn()
        .mockResolvedValue([
          costRow({ currency: { ...CURRENCY, is_active: false } }),
        ]),
    });

    const result = await listCatalog({
      repository,
      priceList: { id: 4, percentage: "30.00" },
    });

    expect(result).toEqual([]);
  });

  it("returns an empty array without running the aggregate queries", async () => {
    const repository = repositoryDouble({
      findCosts: jest.fn().mockResolvedValue([]),
    });

    const result = await listCatalog({
      repository,
      priceList: { id: 4, percentage: "30.00" },
    });

    expect(result).toEqual([]);
    expect(repository.findAvailability).not.toHaveBeenCalled();
    expect(repository.findStockQuantities).not.toHaveBeenCalled();
  });
});

describe("getProductDetail", () => {
  it("returns every priced variant with its availability", async () => {
    const repository = repositoryDouble({
      findAvailability: jest.fn().mockResolvedValue({
        [variantKey(15, 1)]: { stock: 10, reserved: 1, available: true },
      }),
    });

    const result = await getProductDetail({
      repository,
      productId: 15,
      priceList: { id: 4, percentage: "30.00" },
    });

    expect(result.id).toBe(15);
    expect(result.variants).toEqual([
      expect.objectContaining({ available: true, price: 14.29 }),
    ]);
    expect(repository.findStockQuantities).not.toHaveBeenCalled();
  });

  it("marks a priced variant without availability as unavailable", async () => {
    const repository = repositoryDouble({
      findAvailability: jest.fn().mockResolvedValue({}),
    });

    const result = await getProductDetail({
      repository,
      productId: 15,
      priceList: { id: 4, percentage: "30.00" },
    });

    expect(result.variants[0].available).toBe(false);
  });

  it("throws 404 when the product has no priced variant", async () => {
    const repository = repositoryDouble({
      findCosts: jest.fn().mockResolvedValue([]),
    });

    await expect(
      getProductDetail({
        repository,
        productId: 15,
        priceList: { id: 4, percentage: "30.00" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when the filtered state has no cost", async () => {
    const repository = repositoryDouble({
      findCosts: jest
        .fn()
        .mockResolvedValue([
          costRow({ currency: { ...CURRENCY, is_active: false } }),
        ]),
    });

    await expect(
      getProductDetail({
        repository,
        productId: 15,
        itemStateId: 1,
        priceList: { id: 4, percentage: "30.00" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
