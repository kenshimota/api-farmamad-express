const { createSectionService } = require("./section-service");

/**
 * Builds a repository double.
 * @returns {object} The repository double.
 */
function repositoryDouble() {
  return {
    listByShelf: jest.fn().mockResolvedValue([]),
    findByShelfAndId: jest.fn().mockResolvedValue({ id: 2 }),
    create: jest
      .fn()
      .mockImplementation(async (values) => ({ id: 2, ...values })),
    update: jest.fn().mockResolvedValue({ id: 2 }),
    remove: jest.fn().mockResolvedValue(),
  };
}

describe("section service", () => {
  it("delegates list, reads, creation and updates", async () => {
    const repository = repositoryDouble();
    const service = createSectionService({ repository });

    await expect(service.listSections(1)).resolves.toEqual([]);
    await expect(service.getSection(1, 2)).resolves.toEqual({ id: 2 });
    await expect(
      service.createSection({ id: 1 }, { code: "A1-01" }),
    ).resolves.toEqual({ id: 2, shelf_id: 1, code: "A1-01" });
    await expect(
      service.updateSection({ id: 2 }, { code: "A1-02" }),
    ).resolves.toEqual({ id: 2 });

    expect(repository.listByShelf).toHaveBeenCalledWith(1);
    expect(repository.findByShelfAndId).toHaveBeenCalledWith(1, 2);
    expect(repository.create).toHaveBeenCalledWith({
      shelf_id: 1,
      code: "A1-01",
    });
    expect(repository.update).toHaveBeenCalledWith(
      { id: 2 },
      { code: "A1-02" },
    );
  });

  it("deletes when there are no lots", async () => {
    const repository = repositoryDouble();
    const lots = { countSectionLots: jest.fn().mockResolvedValue(0) };
    const service = createSectionService({ repository, lots });
    const section = { id: 2 };

    await expect(service.deleteSection(section)).resolves.toBeUndefined();

    expect(lots.countSectionLots).toHaveBeenCalledWith(2);
    expect(repository.remove).toHaveBeenCalledWith(section);
  });

  it("refuses to delete when lots still reference the section", async () => {
    const repository = repositoryDouble();
    const lots = { countSectionLots: jest.fn().mockResolvedValue(1) };
    const service = createSectionService({ repository, lots });

    await expect(service.deleteSection({ id: 2 })).rejects.toMatchObject({
      status: 409,
      body: { message: "Section has lots" },
    });
    expect(repository.remove).not.toHaveBeenCalled();
  });
});
