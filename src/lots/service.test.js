const { createLotService } = require("./service");

/**
 * Builds a repository double with the methods used by the service.
 * @returns {object} The repository double.
 */
function repositoryDouble() {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    transaction: jest.fn((callback) => callback({ id: "tx" })),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findDuplicate: jest.fn(),
    productExists: jest.fn(),
    itemStateExists: jest.fn(),
    warehouseExists: jest.fn(),
    findShelf: jest.fn(),
    findSection: jest.fn(),
  };
}

/**
 * Builds a valid lot payload.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The lot values.
 */
function values(overrides = {}) {
  return {
    number: "L-1",
    product_id: 1,
    expiration_date: "2027-03-31",
    item_state_id: 2,
    stock: 5,
    reserved: 1,
    warehouse_id: 3,
    shelf_id: 4,
    section_id: 5,
    ...overrides,
  };
}

/**
 * Configures the reference checks as valid.
 * @param {object} repository - Repository double.
 * @returns {void}
 */
function validReferences(repository) {
  repository.productExists.mockResolvedValue(true);
  repository.itemStateExists.mockResolvedValue(true);
  repository.warehouseExists.mockResolvedValue(true);
  repository.findShelf.mockResolvedValue({ id: 4, warehouse_id: 3 });
  repository.findSection.mockResolvedValue({ id: 5, shelf_id: 4 });
}

describe("lot service", () => {
  it("lists and loads lots", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });

    await service.listLots({ productId: 1 });
    await service.getLot(1);

    expect(repository.list).toHaveBeenCalledWith({ productId: 1 });
    expect(repository.findById).toHaveBeenCalledWith(1);
  });

  it("creates a lot inside a transaction", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });
    validReferences(repository);
    repository.create.mockResolvedValue({ id: 9 });
    repository.findById.mockResolvedValue({ id: 9 });

    await expect(service.createLot(values())).resolves.toEqual({ id: 9 });
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(values(), {
      transaction: { id: "tx" },
    });
  });

  it("updates a lot inside a transaction excluding itself from duplicates", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });
    const lot = { id: 9 };
    validReferences(repository);
    repository.findById.mockResolvedValue({ id: 9 });

    await service.updateLot(lot, values());

    expect(repository.findDuplicate).toHaveBeenCalledWith(
      { productId: 1, number: "L-1", excludeId: 9 },
      { transaction: { id: "tx" } },
    );
    expect(repository.update).toHaveBeenCalledWith(lot, values(), {
      transaction: { id: "tx" },
    });
  });

  it("rejects reserved above stock before opening a transaction", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });

    await expect(
      service.createLot(values({ stock: 1, reserved: 2 })),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { reserved: "reserved cannot exceed stock" } },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("rejects missing references and incoherent locations", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });
    validReferences(repository);
    repository.productExists.mockResolvedValue(false);

    await expect(service.createLot(values())).rejects.toMatchObject({
      body: { errors: { product_id: "Invalid product id" } },
    });

    validReferences(repository);
    repository.findShelf.mockResolvedValue({ id: 4, warehouse_id: 99 });
    await expect(service.createLot(values())).rejects.toMatchObject({
      body: {
        errors: { shelf_id: "Shelf does not belong to the warehouse" },
      },
    });

    validReferences(repository);
    repository.findSection.mockResolvedValue({ id: 5, shelf_id: 99 });
    await expect(service.createLot(values())).rejects.toMatchObject({
      body: { errors: { section_id: "Section does not belong to the shelf" } },
    });
  });

  it("rejects a duplicate pair", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });
    validReferences(repository);
    repository.findDuplicate.mockResolvedValue({ id: 99 });

    await expect(service.createLot(values())).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot already exists" },
    });
  });

  it("deletes only lots without quantities", async () => {
    const repository = repositoryDouble();
    const service = createLotService({ repository });

    await service.deleteLot({ stock: 0, reserved: 0 });
    expect(repository.remove).toHaveBeenCalledWith({ stock: 0, reserved: 0 });

    await expect(
      service.deleteLot({ stock: 1, reserved: 0 }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot has stock or reservations" },
    });
  });
});
