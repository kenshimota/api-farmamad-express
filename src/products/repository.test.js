jest.mock("../models/product", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/category", () => ({ findByPk: jest.fn() }));
jest.mock("../models/image", () => ({ findByPk: jest.fn() }));

const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");
const { createProductRepository, LIST_ORDER } = require("./repository");

const repository = createProductRepository();
const VALUES = {
  name: "Ibuprofeno 400 mg",
  description: "Analgésico y antiinflamatorio",
  reference: "IBU-400",
  category_id: 1,
  image_id: 2,
};

beforeEach(() => {
  Product.create.mockReset();
  Product.findAll.mockReset();
  Product.findByPk.mockReset();
  Category.findByPk.mockReset();
  Image.findByPk.mockReset();
});

describe("productRepository", () => {
  it("creates a product through the model", async () => {
    const created = { id: 1, ...VALUES };
    Product.create.mockResolvedValue(created);

    await expect(repository.create(VALUES)).resolves.toBe(created);
    expect(Product.create).toHaveBeenCalledWith(VALUES);
  });

  it("lists products ordered by id ascending", async () => {
    Product.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(Product.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
    expect(LIST_ORDER).toEqual([["id", "ASC"]]);
  });

  it("finds a product by id", async () => {
    const product = { id: 3 };
    Product.findByPk.mockResolvedValue(product);

    await expect(repository.findById(3)).resolves.toBe(product);
    expect(Product.findByPk).toHaveBeenCalledWith(3);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 1 };
    const product = { update: jest.fn().mockResolvedValue(updated) };

    await expect(repository.update(product, VALUES)).resolves.toBe(updated);
    expect(product.update).toHaveBeenCalledWith(VALUES);
  });

  it("removes the loaded instance", async () => {
    const product = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(product)).resolves.toBeUndefined();
    expect(product.destroy).toHaveBeenCalledTimes(1);
  });

  it("checks whether a category exists", async () => {
    Category.findByPk.mockResolvedValueOnce({ id: 1 });
    Category.findByPk.mockResolvedValueOnce(null);

    await expect(repository.categoryExists(1)).resolves.toBe(true);
    await expect(repository.categoryExists(999)).resolves.toBe(false);
    expect(Category.findByPk).toHaveBeenCalledWith(1);
    expect(Category.findByPk).toHaveBeenCalledWith(999);
  });

  it("checks whether an image exists", async () => {
    Image.findByPk.mockResolvedValueOnce({ id: 2 });
    Image.findByPk.mockResolvedValueOnce(null);

    await expect(repository.imageExists(2)).resolves.toBe(true);
    await expect(repository.imageExists(999)).resolves.toBe(false);
    expect(Image.findByPk).toHaveBeenCalledWith(2);
    expect(Image.findByPk).toHaveBeenCalledWith(999);
  });

  it("uses injected models instead of the defaults", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const categoryModel = { findByPk: jest.fn().mockResolvedValue(null) };
    const imageModel = { findByPk: jest.fn().mockResolvedValue(null) };
    const injected = createProductRepository(model, categoryModel, imageModel);

    await injected.create(VALUES);
    await injected.list();
    await injected.findById(1);
    await injected.categoryExists(1);
    await injected.imageExists(2);

    expect(model.create).toHaveBeenCalledWith(VALUES);
    expect(model.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
    expect(model.findByPk).toHaveBeenCalledWith(1);
    expect(categoryModel.findByPk).toHaveBeenCalledWith(1);
    expect(imageModel.findByPk).toHaveBeenCalledWith(2);
    expect(Product.create).not.toHaveBeenCalled();
  });
});
