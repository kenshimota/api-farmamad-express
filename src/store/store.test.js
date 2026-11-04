const {
  INVALID_ITEM_STATE_ID_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  INVALID_PRODUCT_ID_MESSAGE,
  parseItemStateId,
  parseProductId,
} = require("./validators");
const { resolveCatalogPrice } = require("./pricing");
const {
  toStoreDetailVariant,
  toStoreListVariant,
  toStoreProductDetail,
} = require("./serializer");
const {
  CUSTOMER_PRICE_LIST_MESSAGE,
  SELLER_NOT_ASSIGNED_MESSAGE,
  resolveStoreCustomer,
} = require("./guards");

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

describe("store validators", () => {
  it.each([
    ["15", 15],
    [15, 15],
    ["0", null],
    ["-1", null],
    ["abc", null],
    [undefined, null],
  ])("parses product id %p as %p", (value, expected) => {
    expect(parseProductId(value)).toBe(expected);
  });

  it("exposes the documented messages", () => {
    expect(INVALID_PRODUCT_ID_MESSAGE).toBe("Invalid product id");
    expect(INVALID_ITEM_STATE_ID_MESSAGE).toBe("Invalid item state id");
    expect(INVALID_ITEM_STATE_MESSAGE).toBe("Invalid item state");
    expect(parseItemStateId("2")).toBe(2);
    expect(parseItemStateId("x")).toBeNull();
  });
});

describe("store pricing", () => {
  it("uses the shared margin formula in the transaction currency", () => {
    expect(
      resolveCatalogPrice({
        cost: "10.00",
        costCurrency: CURRENCY,
        transactionCurrency: CURRENCY,
        percentage: 30,
      }),
    ).toBe(14.29);
  });

  it("converts between the cost and transaction currencies", () => {
    expect(
      resolveCatalogPrice({
        cost: "10.00",
        costCurrency: { ...CURRENCY, id: 4, rate: "2.000000" },
        transactionCurrency: CURRENCY,
        percentage: 30,
      }),
    ).toBe(28.57);
  });

  it.each([
    [
      "an inactive cost currency",
      { costCurrency: { ...CURRENCY, is_active: false } },
    ],
    ["a zero rate", { costCurrency: { ...CURRENCY, rate: "0" } }],
    ["an invalid percentage", { percentage: 100 }],
    ["a negative cost", { cost: "-1" }],
    ["an out of range price", { cost: "9999999999" }],
  ])("rejects %s", (_label, overrides) => {
    expect(
      resolveCatalogPrice({
        cost: "10.00",
        costCurrency: CURRENCY,
        transactionCurrency: CURRENCY,
        percentage: 30,
        ...overrides,
      }),
    ).toBeNull();
  });
});

describe("store serializer", () => {
  it("builds a list variant with only public fields", () => {
    const variant = toStoreListVariant({
      product: PRODUCT,
      itemState: ITEM_STATE,
      price: 14.29,
      currency: CURRENCY,
      available: true,
    });

    expect(variant).toEqual({
      id: 15,
      name: "Ibuprofeno 400 mg",
      description: "Analgésico y antiinflamatorio",
      reference: "IBU-400",
      category_id: 2,
      image_id: 7,
      item_state: { id: 1, name: "sellable", label: "Vendible" },
      price: 14.29,
      tax: null,
      tax_amount: 0,
      total: 14.29,
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      available: true,
      category: { id: 2, name: "Analgésicos" },
      image: IMAGE,
    });
    expect(variant).not.toHaveProperty("sale_price");
    expect(variant).not.toHaveProperty("quantity");
    expect(variant).not.toHaveProperty("cost");
  });

  it("builds a detail variant and the product detail", () => {
    const variant = toStoreDetailVariant({
      itemState: ITEM_STATE,
      price: 14.29,
      currency: CURRENCY,
      available: false,
    });
    const detail = toStoreProductDetail(PRODUCT, [variant]);

    expect(variant).toEqual({
      item_state: { id: 1, name: "sellable", label: "Vendible" },
      price: 14.29,
      tax: null,
      tax_amount: 0,
      total: 14.29,
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      available: false,
    });
    expect(detail.variants).toEqual([variant]);
    expect(detail).not.toHaveProperty("costs");
  });

  it("keeps a missing category and image as null", () => {
    const variant = toStoreListVariant({
      product: { ...PRODUCT, category: null, image: null },
      itemState: ITEM_STATE,
      price: 14.29,
      currency: CURRENCY,
      available: true,
    });

    expect(variant.category).toBeNull();
    expect(variant.image).toBeNull();
  });

  it("calculates the tax amount and final total of a variant", () => {
    const variant = toStoreListVariant({
      product: PRODUCT,
      itemState: ITEM_STATE,
      price: 14.29,
      tax: { id: 2, code: "IVA", name: "IVA", rate: "16.00" },
      currency: CURRENCY,
      available: true,
    });

    expect(variant.tax).toEqual({
      id: 2,
      code: "IVA",
      name: "IVA",
      rate: 16,
    });
    expect(variant.tax_amount).toBe(2.29);
    expect(variant.total).toBe(16.58);
  });
});

describe("resolveStoreCustomer", () => {
  /**
   * Builds a guard repository double.
   * @param {object} [overrides] - Method overrides.
   * @returns {object} Repository double.
   */
  function guardRepository(overrides = {}) {
    return {
      isCustomerAssigned: jest.fn().mockResolvedValue(true),
      findCustomer: jest.fn().mockResolvedValue({
        id: 8,
        price_list_id: 4,
        price_list: { id: 4, percentage: "30.00" },
      }),
      ...overrides,
    };
  }

  it("resolves the customer own profile and its price list", async () => {
    const repository = guardRepository();
    const context = await resolveStoreCustomer({
      user: {
        id: 10,
        customer_id: 8,
        role: { name: "customer" },
      },
      repository,
    });

    expect(context.customerId).toBe(8);
    expect(context.priceList.id).toBe(4);
    expect(repository.isCustomerAssigned).not.toHaveBeenCalled();
  });

  it("rejects an unlinked customer profile", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 10, role: { name: "customer" } },
        repository: guardRepository(),
      }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: "Customer profile is not linked" },
    });
  });

  it("rejects a customer asking for another customer", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 10, customer_id: 8, role: { name: "customer" } },
        requestedCustomerId: "9",
        repository: guardRepository(),
      }),
    ).rejects.toMatchObject({ status: 403, body: { message: "Forbidden" } });
  });

  it("requires customer_id for administrators and sellers", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 1, role: { name: "admin" } },
        repository: guardRepository(),
      }),
    ).rejects.toMatchObject({
      status: 400,
      body: { message: "customer_id is required" },
    });
  });

  it("rejects a seller that is not assigned to the customer", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 2, role: { name: "seller" } },
        requestedCustomerId: "8",
        repository: guardRepository({
          isCustomerAssigned: jest.fn().mockResolvedValue(false),
        }),
      }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: SELLER_NOT_ASSIGNED_MESSAGE },
    });
  });

  it("rejects a customer without a price list", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 10, customer_id: 8, role: { name: "customer" } },
        repository: guardRepository({
          findCustomer: jest.fn().mockResolvedValue({
            id: 8,
            price_list_id: null,
            price_list: null,
          }),
        }),
      }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: CUSTOMER_PRICE_LIST_MESSAGE },
    });
  });
});
