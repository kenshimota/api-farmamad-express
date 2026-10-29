jest.mock("../models/category", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

const Category = require("../models/category");
const { createCategoryRepository, LIST_ORDER } = require("./repository");

const repository = createCategoryRepository();

beforeEach(() => {
  Category.create.mockReset();
  Category.findAll.mockReset();
  Category.findByPk.mockReset();
});

describe("categoryRepository", () => {
  it("creates a category through the model", async () => {
    const values = { name: "Analgésicos" };
    const created = { id: 1, ...values };
    Category.create.mockResolvedValue(created);

    await expect(repository.create(values)).resolves.toBe(created);
    expect(Category.create).toHaveBeenCalledWith(values);
  });

  it("lists categories ordered by id ascending", async () => {
    Category.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(Category.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
    expect(LIST_ORDER).toEqual([["id", "ASC"]]);
  });

  it("finds a category by id", async () => {
    const category = { id: 3 };
    Category.findByPk.mockResolvedValue(category);

    await expect(repository.findById(3)).resolves.toBe(category);
    expect(Category.findByPk).toHaveBeenCalledWith(3);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 1 };
    const category = { update: jest.fn().mockResolvedValue(updated) };
    const values = { name: "Antiinflamatorios" };

    await expect(repository.update(category, values)).resolves.toBe(updated);
    expect(category.update).toHaveBeenCalledWith(values);
  });

  it("removes the loaded instance", async () => {
    const category = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(category)).resolves.toBeUndefined();
    expect(category.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses an injected model instead of the default one", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const injected = createCategoryRepository(model);

    await injected.create({ name: "Analgésicos" });
    await injected.list();
    await injected.findById(1);

    expect(model.create).toHaveBeenCalledWith({ name: "Analgésicos" });
    expect(model.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
    expect(model.findByPk).toHaveBeenCalledWith(1);
    expect(Category.create).not.toHaveBeenCalled();
  });
});
