jest.mock("../models/cost", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));

const Cost = require("../models/cost");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const {
  ITEM_STATE_ATTRIBUTES,
  LIST_ORDER,
  createCostRepository,
} = require("./repository");

const repository = createCostRepository();

beforeEach(() => {
  Cost.create.mockReset();
  Cost.findAll.mockReset();
  Cost.findByPk.mockReset();
  Product.findByPk.mockReset();
  ItemState.findByPk.mockReset();
});

describe("costRepository", () => {
  it("creates a cost and reloads it with its item state", async () => {
    const values = { product_id: 1, item_state_id: 2, cost: 12.5 };
    const stored = { id: 3, ...values, item_state: { id: 2 } };
    Cost.create.mockResolvedValue({ id: 3 });
    Cost.findByPk.mockResolvedValue(stored);

    await expect(repository.create(values)).resolves.toBe(stored);
    expect(Cost.create).toHaveBeenCalledWith(values);
    expect(Cost.findByPk).toHaveBeenCalledWith(3, {
      include: [
        {
          model: ItemState,
          as: "item_state",
          attributes: [...ITEM_STATE_ATTRIBUTES],
        },
      ],
    });
  });

  it("lists costs ordered by product and item state", async () => {
    Cost.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(Cost.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [
        {
          model: ItemState,
          as: "item_state",
          attributes: [...ITEM_STATE_ATTRIBUTES],
        },
      ],
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
  ])("filters with %p", async (filters, where) => {
    Cost.findAll.mockResolvedValue([]);

    await repository.list(filters);

    expect(Cost.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where,
      include: [
        {
          model: ItemState,
          as: "item_state",
          attributes: [...ITEM_STATE_ATTRIBUTES],
        },
      ],
    });
  });

  it("lists the costs of one product", async () => {
    Cost.findAll.mockResolvedValue([]);

    await repository.listByProduct(7);

    expect(Cost.findAll).toHaveBeenCalledWith({
      where: { product_id: 7 },
      order: LIST_ORDER,
      include: [
        {
          model: ItemState,
          as: "item_state",
          attributes: [...ITEM_STATE_ATTRIBUTES],
        },
      ],
    });
  });

  it("finds a cost by id with its item state", async () => {
    const cost = { id: 3 };
    Cost.findByPk.mockResolvedValue(cost);

    await expect(repository.findById(3)).resolves.toBe(cost);
    expect(Cost.findByPk).toHaveBeenCalledWith(3, {
      include: [
        {
          model: ItemState,
          as: "item_state",
          attributes: [...ITEM_STATE_ATTRIBUTES],
        },
      ],
    });
  });

  it("updates the loaded instance and reloads it", async () => {
    const updated = { id: 1, cost: 20 };
    const cost = {
      id: 1,
      update: jest.fn().mockResolvedValue(updated),
    };
    Cost.findByPk.mockResolvedValue(updated);

    await expect(repository.update(cost, { cost: 20 })).resolves.toBe(updated);
    expect(cost.update).toHaveBeenCalledWith({ cost: 20 });
    expect(Cost.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it("removes the loaded instance", async () => {
    const cost = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(cost)).resolves.toBeUndefined();
    expect(cost.destroy).toHaveBeenCalledTimes(1);
  });

  it("checks whether a product exists", async () => {
    Product.findByPk.mockResolvedValueOnce({ id: 1 });
    Product.findByPk.mockResolvedValueOnce(null);

    await expect(repository.productExists(1)).resolves.toBe(true);
    await expect(repository.productExists(99)).resolves.toBe(false);
    expect(Product.findByPk).toHaveBeenCalledWith(1);
    expect(Product.findByPk).toHaveBeenCalledWith(99);
  });

  it("checks whether an item state exists", async () => {
    ItemState.findByPk.mockResolvedValueOnce({ id: 2 });
    ItemState.findByPk.mockResolvedValueOnce(undefined);

    await expect(repository.itemStateExists(2)).resolves.toBe(true);
    await expect(repository.itemStateExists(99)).resolves.toBe(false);
    expect(ItemState.findByPk).toHaveBeenCalledWith(2);
    expect(ItemState.findByPk).toHaveBeenCalledWith(99);
  });

  it("uses injected models instead of the default ones", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const productModel = { findByPk: jest.fn().mockResolvedValue({ id: 1 }) };
    const itemStateModel = {
      findByPk: jest.fn().mockResolvedValue({ id: 2 }),
    };
    const injected = createCostRepository(model, productModel, itemStateModel);

    await injected.create({ product_id: 1, item_state_id: 2, cost: 1 });
    await injected.list();
    await injected.productExists(1);
    await injected.itemStateExists(2);

    expect(model.create).toHaveBeenCalledWith({
      product_id: 1,
      item_state_id: 2,
      cost: 1,
    });
    expect(model.findAll).toHaveBeenCalledTimes(1);
    expect(productModel.findByPk).toHaveBeenCalledWith(1);
    expect(itemStateModel.findByPk).toHaveBeenCalledWith(2);
    expect(Cost.create).not.toHaveBeenCalled();
  });
});
