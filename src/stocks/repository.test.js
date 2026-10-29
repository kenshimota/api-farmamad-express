jest.mock("../models/stock", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/item-state", () => ({}));
jest.mock("../models/cost", () => ({}));

const { Op } = require("sequelize");
const Stock = require("../models/stock");
const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const {
  ITEM_STATE_ATTRIBUTES,
  LIST_ORDER,
  PRODUCT_LIST_ORDER,
  createStockRepository,
} = require("./repository");

const purchaseService = { applyPurchaseItems: jest.fn() };
const repository = createStockRepository(
  Stock,
  ItemState,
  Cost,
  purchaseService,
);

const ITEM_STATE_INCLUDE = {
  model: ItemState,
  as: "item_state",
  attributes: [...ITEM_STATE_ATTRIBUTES],
};

beforeEach(() => {
  Stock.findAll.mockReset();
  Stock.findByPk.mockReset();
  purchaseService.applyPurchaseItems.mockReset();
});

describe("stockRepository", () => {
  it("lists stocks ordered by product and item state", async () => {
    Stock.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(Stock.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [ITEM_STATE_INCLUDE],
    });
    expect(LIST_ORDER).toEqual([
      ["product_id", "ASC"],
      ["item_state_id", "ASC"],
    ]);
  });

  it.each([
    [{ productId: 1 }, { product_id: 1 }],
    [{ itemStateId: 2 }, { item_state_id: 2 }],
    [
      { productId: 1, itemStateId: 2 },
      { product_id: 1, item_state_id: 2 },
    ],
    [{ inStock: true }, { quantity: { [Op.gt]: 0 } }],
    [{ inStock: false }, { quantity: { [Op.eq]: 0 } }],
  ])("filters with %p", async (filters, where) => {
    Stock.findAll.mockResolvedValue([]);

    await repository.list(filters);

    expect(Stock.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where,
      include: [ITEM_STATE_INCLUDE],
    });
  });

  it("lists the stocks of one product ordered by item state", async () => {
    Stock.findAll.mockResolvedValue([]);

    await repository.listByProduct(7);

    expect(Stock.findAll).toHaveBeenCalledWith({
      where: { product_id: 7 },
      order: PRODUCT_LIST_ORDER,
      include: [ITEM_STATE_INCLUDE],
    });
    expect(PRODUCT_LIST_ORDER).toEqual([["item_state_id", "ASC"]]);
  });

  it("finds a stock by id with its item state", async () => {
    const stock = { id: 3 };
    Stock.findByPk.mockResolvedValue(stock);

    await expect(repository.findById(3)).resolves.toBe(stock);
    expect(Stock.findByPk).toHaveBeenCalledWith(3, {
      include: [ITEM_STATE_INCLUDE],
    });
  });

  it("lists the sellable stock of one product ordered by state name", async () => {
    Stock.findAll.mockResolvedValue([]);

    await repository.listAvailable(15);

    const [options] = Stock.findAll.mock.calls[0];

    expect(options.where).toEqual({
      product_id: 15,
      quantity: { [Op.gt]: 0 },
    });
    expect(options.order).toEqual([
      [{ model: ItemState, as: "item_state" }, "name", "ASC"],
    ]);
    expect(options.include).toEqual([
      {
        model: ItemState,
        as: "item_state",
        attributes: [...ITEM_STATE_ATTRIBUTES],
        required: true,
        where: { is_sellable: true },
      },
      expect.objectContaining({
        model: Cost,
        as: "cost",
        attributes: ["product_id", "item_state_id", "cost", "currency_id"],
        required: false,
        include: [
          {
            model: Currency,
            as: "currency",
            attributes: ["id", "code", "name", "symbol"],
          },
        ],
      }),
    ]);
    expect(options.include[1].on).toBeDefined();
  });

  it("delegates the transactional purchase increment to the service", async () => {
    const items = [{ product_id: 1, item_state_id: 2, quantity: 3 }];
    const transaction = { id: "tx" };
    purchaseService.applyPurchaseItems.mockResolvedValue([{ id: 1 }]);

    await expect(
      repository.applyPurchaseItems(items, { transaction }),
    ).resolves.toEqual([{ id: 1 }]);
    expect(purchaseService.applyPurchaseItems).toHaveBeenCalledWith(items, {
      transaction,
    });
  });

  it("uses injected models instead of the default ones", async () => {
    const model = { findAll: jest.fn().mockResolvedValue([]) };
    const itemStateModel = {};
    const costModel = {};
    const service = { applyPurchaseItems: jest.fn() };
    const injected = createStockRepository(
      model,
      itemStateModel,
      costModel,
      service,
    );

    await injected.list();

    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [
        {
          model: itemStateModel,
          as: "item_state",
          attributes: [...ITEM_STATE_ATTRIBUTES],
        },
      ],
    });
    expect(Stock.findAll).not.toHaveBeenCalled();
  });
});
