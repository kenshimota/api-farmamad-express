const {
  LIST_ORDER,
  SECTIONS_INCLUDE,
  createShelfRepository,
} = require("./shelf-repository");

/**
 * Builds the model doubles.
 * @returns {object} The injectable doubles.
 */
function doubles() {
  return {
    model: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue({ id: 1 }),
    },
    sectionModel: {
      findAll: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]),
    },
    warehouseModel: {
      findByPk: jest.fn().mockResolvedValue({ id: 1 }),
    },
  };
}

describe("shelf repository", () => {
  it("creates and lists with the documented options", async () => {
    const { model, sectionModel, warehouseModel } = doubles();
    const repository = createShelfRepository({
      model,
      sectionModel,
      warehouseModel,
    });

    await repository.create({ code: "A1" });
    expect(model.create).toHaveBeenCalledWith({ code: "A1" });

    await repository.list();
    expect(model.findAll).toHaveBeenLastCalledWith({ order: LIST_ORDER });

    await repository.list({ warehouseId: 2, includeSections: true });
    expect(model.findAll).toHaveBeenLastCalledWith({
      order: LIST_ORDER,
      where: { warehouse_id: 2 },
      include: SECTIONS_INCLUDE,
    });
  });

  it("finds, updates and removes through the model", async () => {
    const { model, sectionModel, warehouseModel } = doubles();
    const repository = createShelfRepository({
      model,
      sectionModel,
      warehouseModel,
    });
    const shelf = { update: jest.fn(), destroy: jest.fn() };

    await repository.findById(1);
    await repository.findByIdWithSections(1);
    await repository.update(shelf, { code: "A2" });
    await repository.remove(shelf);

    expect(model.findByPk).toHaveBeenNthCalledWith(1, 1);
    expect(model.findByPk).toHaveBeenNthCalledWith(2, 1, {
      include: SECTIONS_INCLUDE,
    });
    expect(shelf.update).toHaveBeenCalledWith({ code: "A2" });
    expect(shelf.destroy).toHaveBeenCalledTimes(1);
  });

  it("checks the warehouse and lists section ids", async () => {
    const { model, sectionModel, warehouseModel } = doubles();
    const repository = createShelfRepository({
      model,
      sectionModel,
      warehouseModel,
    });

    await expect(repository.warehouseExists(1)).resolves.toBe(true);
    warehouseModel.findByPk.mockResolvedValueOnce(null);
    await expect(repository.warehouseExists(9)).resolves.toBe(false);

    await expect(repository.sectionIds(1)).resolves.toEqual([2, 3]);
    expect(sectionModel.findAll).toHaveBeenCalledWith({
      where: { shelf_id: 1 },
      attributes: ["id"],
    });
  });
});
