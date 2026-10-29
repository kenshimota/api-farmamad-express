jest.mock("../models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/cost", () => ({ findOne: jest.fn() }));
jest.mock("../models/stock", () => ({ findOne: jest.fn() }));

const ItemState = require("../models/item-state");
const Cost = require("../models/cost");
const Stock = require("../models/stock");
const { createItemStateRepository, LIST_ORDER } = require("./repository");

const repository = createItemStateRepository();

beforeEach(() => {
  ItemState.create.mockReset();
  ItemState.findAll.mockReset();
  ItemState.findByPk.mockReset();
  Cost.findOne.mockReset();
  Stock.findOne.mockReset();
});

describe("itemStateRepository", () => {
  it("creates an item state through the model", async () => {
    const values = { name: "sellable", label: "Vendible", is_sellable: true };
    const created = { id: 1, ...values };
    ItemState.create.mockResolvedValue(created);

    await expect(repository.create(values)).resolves.toBe(created);
    expect(ItemState.create).toHaveBeenCalledWith(values);
  });

  it("lists item states ordered by name ascending", async () => {
    ItemState.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(ItemState.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
    });
    expect(LIST_ORDER).toEqual([["name", "ASC"]]);
  });

  it.each([
    [true, { is_sellable: true }],
    [false, { is_sellable: false }],
  ])("filters by is_sellable=%p", async (isSellable, where) => {
    ItemState.findAll.mockResolvedValue([]);

    await repository.list({ isSellable });

    expect(ItemState.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
      where,
    });
  });

  it("finds an item state by id", async () => {
    const itemState = { id: 3 };
    ItemState.findByPk.mockResolvedValue(itemState);

    await expect(repository.findById(3)).resolves.toBe(itemState);
    expect(ItemState.findByPk).toHaveBeenCalledWith(3);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 1 };
    const itemState = { update: jest.fn().mockResolvedValue(updated) };
    const values = { label: "Vendible" };

    await expect(repository.update(itemState, values)).resolves.toBe(updated);
    expect(itemState.update).toHaveBeenCalledWith(values);
  });

  it("removes the loaded instance", async () => {
    const itemState = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(itemState)).resolves.toBeUndefined();
    expect(itemState.destroy).toHaveBeenCalledTimes(1);
  });

  it("reports whether costs reference the item state", async () => {
    Cost.findOne.mockResolvedValueOnce({ id: 1 });

    await expect(repository.isReferenced(1)).resolves.toBe(true);
    expect(Cost.findOne).toHaveBeenCalledWith({
      where: { item_state_id: 1 },
    });
    expect(Stock.findOne).not.toHaveBeenCalled();
  });

  it("reports whether stocks reference the item state", async () => {
    Cost.findOne.mockResolvedValueOnce(null);
    Stock.findOne.mockResolvedValueOnce({ id: 2 });

    await expect(repository.isReferenced(2)).resolves.toBe(true);
    expect(Cost.findOne).toHaveBeenCalledWith({
      where: { item_state_id: 2 },
    });
    expect(Stock.findOne).toHaveBeenCalledWith({
      where: { item_state_id: 2 },
    });
  });

  it("returns false when neither costs nor stocks reference the item state", async () => {
    Cost.findOne.mockResolvedValueOnce(null);
    Stock.findOne.mockResolvedValueOnce(null);

    await expect(repository.isReferenced(99)).resolves.toBe(false);
    expect(Cost.findOne).toHaveBeenCalledWith({
      where: { item_state_id: 99 },
    });
    expect(Stock.findOne).toHaveBeenCalledWith({
      where: { item_state_id: 99 },
    });
  });

  it("uses an injected model instead of the default one", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const injected = createItemStateRepository(model);

    await injected.create({ name: "sellable", label: "Vendible" });
    await injected.list();
    await injected.findById(1);

    expect(model.create).toHaveBeenCalledWith({
      name: "sellable",
      label: "Vendible",
    });
    expect(model.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
    });
    expect(model.findByPk).toHaveBeenCalledWith(1);
    expect(ItemState.create).not.toHaveBeenCalled();
  });
});
