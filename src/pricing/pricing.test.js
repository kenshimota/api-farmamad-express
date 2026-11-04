const {
  CUSTOMER_PRICE_LIST_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  NO_PRICE_MESSAGE,
  OUT_OF_RANGE_MESSAGE,
  createPriceResolver,
  round2,
} = require("./index");

/**
 * Builds the dependency doubles used by the resolver.
 * @param {object} [overrides] - Dependency overrides.
 * @returns {object} Resolver dependencies.
 */
function dependencies(overrides = {}) {
  return {
    itemStateModel: {
      findByPk: jest.fn().mockResolvedValue({ id: 2, is_sellable: true }),
    },
    costModel: {
      findOne: jest.fn().mockResolvedValue({
        product_id: 15,
        item_state_id: 2,
        cost: "10.00",
        currency_id: 1,
        currency: { id: 1, rate: "1.000000", is_active: true },
      }),
    },
    priceListModel: {
      findByPk: jest.fn().mockResolvedValue({ id: 1, percentage: "30.00" }),
    },
    productModel: {
      findByPk: jest.fn().mockResolvedValue({
        id: 15,
        tax: {
          id: 2,
          code: "IVA",
          name: "Impuesto al Valor Agregado",
          rate: "16.00",
        },
      }),
    },
    taxModel: {},
    currencyModel: { findByPk: jest.fn() },
    resolveTransactionCurrency: jest
      .fn()
      .mockResolvedValue({ id: 2, rate: "1.000000", is_active: true }),
    ...overrides,
  };
}

describe("round2", () => {
  it.each([
    [14.285714, 14.29],
    [10, 10],
    [0.005, 0.01],
    ["12.345", 12.35],
  ])("rounds %p to %p", (value, expected) => {
    expect(round2(value)).toBe(expected);
  });
});

describe("createPriceResolver", () => {
  it("resolves the margin formula and rounds to two decimals", async () => {
    const deps = dependencies();
    const resolvePrice = createPriceResolver(deps);

    const result = await resolvePrice({
      product_id: 15,
      item_state_id: 2,
      price_list_id: 1,
    });

    expect(result).toEqual({
      product_id: 15,
      item_state_id: 2,
      price_list_id: 1,
      price: 14.29,
      currency: { id: 2, rate: "1.000000", is_active: true },
      tax: {
        tax_id: 2,
        tax_code: "IVA",
        tax_name: "Impuesto al Valor Agregado",
        tax_rate: 16,
      },
    });
  });

  it("converts from the cost currency to the transaction currency", async () => {
    const deps = dependencies({
      costModel: {
        findOne: jest.fn().mockResolvedValue({
          product_id: 15,
          item_state_id: 2,
          cost: "10.00",
          currency_id: 3,
          currency: { id: 3, rate: "2.000000", is_active: true },
        }),
      },
    });
    const resolvePrice = createPriceResolver(deps);

    const result = await resolvePrice({
      product_id: 15,
      item_state_id: 2,
      price_list_id: 1,
      transactionCurrency: { id: 4, rate: "1.000000", is_active: true },
    });

    expect(result.price).toBe(28.57);
    expect(deps.resolveTransactionCurrency).not.toHaveBeenCalled();
  });

  it("resolves the active default transaction currency when none is passed", async () => {
    const deps = dependencies();
    const resolvePrice = createPriceResolver(deps);

    await resolvePrice({ product_id: 15, item_state_id: 2, price_list_id: 1 });

    expect(deps.resolveTransactionCurrency).toHaveBeenCalledTimes(1);
  });

  it("uses the cost currency loaded from the currency model when it is not nested", async () => {
    const deps = dependencies({
      costModel: {
        findOne: jest.fn().mockResolvedValue({
          product_id: 15,
          item_state_id: 2,
          cost: "10.00",
          currency_id: 3,
        }),
      },
      currencyModel: {
        findByPk: jest
          .fn()
          .mockResolvedValue({ id: 3, rate: "1.000000", is_active: true }),
      },
    });
    const resolvePrice = createPriceResolver(deps);

    const result = await resolvePrice({
      product_id: 15,
      item_state_id: 2,
      price_list_id: 1,
    });

    expect(deps.currencyModel.findByPk).toHaveBeenCalledWith(3);
    expect(result.price).toBe(14.29);
  });

  it("answers 403 when the customer has no price list", async () => {
    const resolvePrice = createPriceResolver(dependencies());

    await expect(
      resolvePrice({ product_id: 15, item_state_id: 2, price_list_id: null }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: CUSTOMER_PRICE_LIST_MESSAGE },
    });
  });

  it("answers 422 when the item state is missing or not sellable", async () => {
    const missing = createPriceResolver(
      dependencies({
        itemStateModel: { findByPk: jest.fn().mockResolvedValue(null) },
      }),
    );

    await expect(
      missing({ product_id: 15, item_state_id: 99, price_list_id: 1 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { item_state_id: INVALID_ITEM_STATE_MESSAGE } },
    });

    const notSellable = createPriceResolver(
      dependencies({
        itemStateModel: {
          findByPk: jest.fn().mockResolvedValue({ id: 2, is_sellable: false }),
        },
      }),
    );

    await expect(
      notSellable({ product_id: 15, item_state_id: 2, price_list_id: 1 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { item_state_id: INVALID_ITEM_STATE_MESSAGE } },
    });
  });

  it("answers 422 when the product has no valid cost", async () => {
    const deps = dependencies({
      costModel: { findOne: jest.fn().mockResolvedValue(null) },
    });
    const resolvePrice = createPriceResolver(deps);

    await expect(
      resolvePrice({ product_id: 15, item_state_id: 2, price_list_id: 1 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { product_id: NO_PRICE_MESSAGE } },
    });
  });

  it("answers 422 when the cost is negative or its currency is inactive", async () => {
    const negative = createPriceResolver(
      dependencies({
        costModel: {
          findOne: jest.fn().mockResolvedValue({
            product_id: 15,
            item_state_id: 2,
            cost: "-1.00",
            currency_id: 1,
            currency: { id: 1, rate: "1.000000", is_active: true },
          }),
        },
      }),
    );

    await expect(
      negative({ product_id: 15, item_state_id: 2, price_list_id: 1 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { product_id: NO_PRICE_MESSAGE } },
    });

    const inactive = createPriceResolver(
      dependencies({
        costModel: {
          findOne: jest.fn().mockResolvedValue({
            product_id: 15,
            item_state_id: 2,
            cost: "10.00",
            currency_id: 1,
            currency: { id: 1, rate: "1.000000", is_active: false },
          }),
        },
      }),
    );

    await expect(
      inactive({ product_id: 15, item_state_id: 2, price_list_id: 1 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { product_id: NO_PRICE_MESSAGE } },
    });
  });

  it("answers 422 when the calculated price exceeds DECIMAL(12,2)", async () => {
    const deps = dependencies({
      costModel: {
        findOne: jest.fn().mockResolvedValue({
          product_id: 15,
          item_state_id: 2,
          cost: "999999999.99",
          currency_id: 1,
          currency: { id: 1, rate: "1.000000", is_active: true },
        }),
      },
      priceListModel: {
        findByPk: jest.fn().mockResolvedValue({ id: 1, percentage: "99.90" }),
      },
    });
    const resolvePrice = createPriceResolver(deps);

    await expect(
      resolvePrice({ product_id: 15, item_state_id: 2, price_list_id: 1 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { product_id: OUT_OF_RANGE_MESSAGE } },
    });
  });
});
