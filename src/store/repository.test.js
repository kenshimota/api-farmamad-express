const { createStoreRepository, variantKey } = require("./repository");

/**
 * Builds a model double with the given resolved rows.
 * @param {object[]} [rows] - Rows returned by findAll/findByPk.
 * @returns {object} Model double.
 */
function modelDouble(rows = []) {
  return {
    findAll: jest.fn().mockResolvedValue(rows),
    findByPk: jest.fn().mockResolvedValue(rows[0] ?? null),
    findOne: jest.fn().mockResolvedValue(rows[0] ?? null),
    count: jest.fn().mockResolvedValue(rows.length),
  };
}

/**
 * Builds a fully injectable repository for query-shape assertions.
 * @returns {object} Repository with its scoped models.
 */
function buildRepository() {
  const models = {
    costModel: modelDouble([
      { product_id: 15, item_state_id: 1, cost: "10.00", currency_id: 3 },
    ]),
    itemStateModel: modelDouble([{ id: 1, name: "sellable" }]),
    customerModel: modelDouble([
      { id: 8, price_list_id: 4, price_list: { id: 4, percentage: 30 } },
    ]),
    customerSellerModel: modelDouble([{ id: 1 }]),
    priceListModel: modelDouble([{ id: 4, percentage: 30 }]),
    lotModel: modelDouble([
      {
        product_id: 15,
        item_state_id: 1,
        stock_total: "10",
        reserved_total: "2",
      },
    ]),
    stockModel: modelDouble([
      { product_id: 15, item_state_id: 1, quantity: 10 },
    ]),
    currencyModel: modelDouble([{ id: 3, is_active: true }]),
    productModel: {},
    categoryModel: {},
    imageModel: {},
  };
  const resolveTransactionCurrency = jest
    .fn()
    .mockResolvedValue({ id: 3, is_active: true });

  return {
    models,
    resolveTransactionCurrency,
    repository: createStoreRepository({
      ...models,
      resolveTransactionCurrency,
    }),
  };
}

describe("createStoreRepository", () => {
  it("loads the customer with its price list", async () => {
    const { repository, models } = buildRepository();

    const customer = await repository.findCustomer(8);

    expect(customer.id).toBe(8);
    expect(models.customerModel.findByPk).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        include: [
          expect.objectContaining({
            model: models.priceListModel,
            as: "price_list",
          }),
        ],
      }),
    );
  });

  it("checks the seller assignment by customer and seller", async () => {
    const { repository, models } = buildRepository();

    await expect(repository.isCustomerAssigned(8, 2)).resolves.toBe(true);
    expect(models.customerSellerModel.count).toHaveBeenCalledWith({
      where: { customer_id: 8, seller_id: 2 },
    });
  });

  it("resolves the default transaction currency through the shared helper", async () => {
    const { repository, resolveTransactionCurrency, models } =
      buildRepository();

    await repository.findDefaultCurrency();

    expect(resolveTransactionCurrency).toHaveBeenCalledWith({
      model: models.currencyModel,
    });
  });

  it("lists costs with product, item state and currency joins", async () => {
    const { repository, models } = buildRepository();

    const rows = await repository.findCosts({ itemStateId: 1 });

    expect(rows).toHaveLength(1);
    const options = models.costModel.findAll.mock.calls[0][0];

    expect(options.where).toEqual({ item_state_id: 1 });
    expect(options.include.map((include) => include.as)).toEqual([
      "product",
      "item_state",
      "currency",
    ]);
    expect(options.include[1].where).toEqual({ is_sellable: true });
    expect(options.include[2].where).toEqual({ is_active: true });
    expect(options.order).toBeDefined();
  });

  it("filters the cost query by product for the detail", async () => {
    const { repository, models } = buildRepository();

    await repository.findCosts({ productId: 15, itemStateId: 1 });

    expect(models.costModel.findAll.mock.calls[0][0].where).toEqual({
      product_id: 15,
      item_state_id: 1,
    });
  });

  it("aggregates lots into an availability map", async () => {
    const { repository, models } = buildRepository();

    const availability = await repository.findAvailability({
      productIds: [15],
      itemStateIds: [1],
    });

    expect(availability[variantKey(15, 1)]).toEqual({
      stock: 10,
      reserved: 2,
      available: true,
    });
    const options = models.lotModel.findAll.mock.calls[0][0];
    expect(options.group).toEqual(["product_id", "item_state_id"]);
    expect(options.raw).toBe(true);
  });

  it("does not query lots or stocks without keys", async () => {
    const { repository, models } = buildRepository();

    await expect(
      repository.findAvailability({ productIds: [], itemStateIds: [] }),
    ).resolves.toEqual({});
    await expect(
      repository.findStockQuantities({ productIds: [], itemStateIds: [] }),
    ).resolves.toEqual({});

    expect(models.lotModel.findAll).not.toHaveBeenCalled();
    expect(models.stockModel.findAll).not.toHaveBeenCalled();
  });

  it("builds the stock quantity map", async () => {
    const { repository } = buildRepository();

    const stocks = await repository.findStockQuantities({
      productIds: [15],
      itemStateIds: [1],
    });

    expect(stocks[variantKey(15, 1)]).toBe(10);
  });

  it("loads one item state by primary key", async () => {
    const { repository, models } = buildRepository();

    const itemState = await repository.findItemState(1);

    expect(itemState.id).toBe(1);
    expect(models.itemStateModel.findByPk).toHaveBeenCalledWith(1, {
      attributes: ["id", "name", "label", "is_sellable"],
    });
  });
});
