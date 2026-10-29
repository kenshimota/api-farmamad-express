const { LIST_ORDER, createSectionRepository } = require("./section-repository");

/**
 * Builds the model double.
 * @returns {object} The model double.
 */
function modelDouble() {
  return {
    create: jest.fn().mockResolvedValue({ id: 2 }),
    findAll: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]),
    findOne: jest.fn().mockResolvedValue({ id: 2 }),
  };
}

describe("section repository", () => {
  it("creates, lists and finds scoped to the shelf", async () => {
    const model = modelDouble();
    const repository = createSectionRepository({ model });

    await repository.create({ shelf_id: 1, code: "A1-01" });
    await repository.listByShelf(1);
    await repository.findByShelfAndId(1, 2);

    expect(model.create).toHaveBeenCalledWith({
      shelf_id: 1,
      code: "A1-01",
    });
    expect(model.findAll).toHaveBeenCalledWith({
      where: { shelf_id: 1 },
      order: LIST_ORDER,
    });
    expect(model.findOne).toHaveBeenCalledWith({
      where: { id: 2, shelf_id: 1 },
    });
  });

  it("lists the section ids", async () => {
    const model = modelDouble();
    const repository = createSectionRepository({ model });

    await expect(repository.listIdsByShelf(1)).resolves.toEqual([2, 3]);
    expect(model.findAll).toHaveBeenCalledWith({
      where: { shelf_id: 1 },
      attributes: ["id"],
    });
  });

  it("updates and removes through the instance", async () => {
    const repository = createSectionRepository({ model: modelDouble() });
    const section = { update: jest.fn(), destroy: jest.fn() };

    await repository.update(section, { code: "A1-02" });
    await repository.remove(section);

    expect(section.update).toHaveBeenCalledWith({ code: "A1-02" });
    expect(section.destroy).toHaveBeenCalledTimes(1);
  });
});
