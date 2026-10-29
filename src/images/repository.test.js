jest.mock("../models/image", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

const Image = require("../models/image");
const { createImageRepository, LIST_ORDER } = require("./repository");

const repository = createImageRepository();
const VALUES = {
  url: "https://cdn.farmamad.com/products/ibuprofeno.png",
  pathname: "/uploads/products/ibuprofeno.png",
  reference: "ibuprofeno-400",
  thumbnail: "https://cdn.farmamad.com/products/ibuprofeno-thumb.png",
};

beforeEach(() => {
  Image.create.mockReset();
  Image.findAll.mockReset();
  Image.findByPk.mockReset();
});

describe("imageRepository", () => {
  it("creates an image through the model", async () => {
    const created = { id: 1, ...VALUES };
    Image.create.mockResolvedValue(created);

    await expect(repository.create(VALUES)).resolves.toBe(created);
    expect(Image.create).toHaveBeenCalledWith(VALUES);
  });

  it("lists images ordered by id ascending", async () => {
    Image.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(Image.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
    expect(LIST_ORDER).toEqual([["id", "ASC"]]);
  });

  it("finds an image by id", async () => {
    const image = { id: 3 };
    Image.findByPk.mockResolvedValue(image);

    await expect(repository.findById(3)).resolves.toBe(image);
    expect(Image.findByPk).toHaveBeenCalledWith(3);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 1 };
    const image = { update: jest.fn().mockResolvedValue(updated) };

    await expect(repository.update(image, VALUES)).resolves.toBe(updated);
    expect(image.update).toHaveBeenCalledWith(VALUES);
  });

  it("removes the loaded instance", async () => {
    const image = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(image)).resolves.toBeUndefined();
    expect(image.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses an injected model instead of the default one", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const injected = createImageRepository(model);

    await injected.create(VALUES);
    await injected.list();
    await injected.findById(1);

    expect(model.create).toHaveBeenCalledWith(VALUES);
    expect(model.findAll).toHaveBeenCalledWith({ order: [["id", "ASC"]] });
    expect(model.findByPk).toHaveBeenCalledWith(1);
    expect(Image.create).not.toHaveBeenCalled();
  });
});
