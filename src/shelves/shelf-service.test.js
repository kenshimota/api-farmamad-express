const { createShelfService } = require("./shelf-service");

/**
 * Builds a repository double.
 * @returns {object} The repository double.
 */
function repositoryDouble() {
  return {
    list: jest.fn().mockResolvedValue([]),
    findByIdWithSections: jest.fn().mockResolvedValue({ id: 1 }),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    warehouseExists: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    remove: jest.fn().mockResolvedValue(),
    sectionIds: jest.fn().mockResolvedValue([2]),
  };
}

describe("shelf service", () => {
  it("delegates list, reads and updates", async () => {
    const repository = repositoryDouble();
    const service = createShelfService({ repository });
    const shelf = { id: 1 };

    await expect(service.listShelves({ warehouseId: 1 })).resolves.toEqual([]);
    await expect(service.getShelf(1)).resolves.toEqual({ id: 1 });
    await expect(service.getShelfWithoutSections(1)).resolves.toEqual({
      id: 1,
    });
    await expect(service.updateShelf(shelf, { code: "A1" })).resolves.toEqual({
      id: 1,
    });

    expect(repository.list).toHaveBeenCalledWith({ warehouseId: 1 });
    expect(repository.findByIdWithSections).toHaveBeenCalledWith(1);
    expect(repository.findById).toHaveBeenCalledWith(1);
    expect(repository.update).toHaveBeenCalledWith(shelf, { code: "A1" });
  });

  it("creates a shelf only when the warehouse exists", async () => {
    const repository = repositoryDouble();
    const service = createShelfService({ repository });

    await expect(
      service.createShelf({ warehouse_id: 1, code: "A1" }),
    ).resolves.toEqual({ id: 1 });
    expect(repository.create).toHaveBeenCalledWith({
      warehouse_id: 1,
      code: "A1",
    });

    repository.warehouseExists.mockResolvedValue(false);
    await expect(
      service.createShelf({ warehouse_id: 9, code: "A1" }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { warehouse_id: "Invalid warehouse id" } },
    });
  });

  it("deletes when there are no lots and uses the loaded sections", async () => {
    const repository = repositoryDouble();
    const lots = { countShelfLots: jest.fn().mockResolvedValue(0) };
    const service = createShelfService({ repository, lots });
    const shelf = { id: 1, sections: [{ id: 2 }, { id: 3 }] };

    await expect(service.deleteShelf(shelf)).resolves.toBeUndefined();

    expect(lots.countShelfLots).toHaveBeenCalledWith(1, [2, 3]);
    expect(repository.sectionIds).not.toHaveBeenCalled();
    expect(repository.remove).toHaveBeenCalledWith(shelf);
  });

  it("loads the section ids when the shelf did not include them", async () => {
    const repository = repositoryDouble();
    const lots = { countShelfLots: jest.fn().mockResolvedValue(0) };
    const service = createShelfService({ repository, lots });
    const shelf = { id: 1 };

    await service.deleteShelf(shelf);

    expect(repository.sectionIds).toHaveBeenCalledWith(1);
    expect(lots.countShelfLots).toHaveBeenCalledWith(1, [2]);
  });

  it("refuses to delete when lots still reference the shelf", async () => {
    const repository = repositoryDouble();
    const lots = { countShelfLots: jest.fn().mockResolvedValue(1) };
    const service = createShelfService({ repository, lots });

    await expect(
      service.deleteShelf({ id: 1, sections: [] }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Shelf has lots" },
    });
    expect(repository.remove).not.toHaveBeenCalled();
  });
});
