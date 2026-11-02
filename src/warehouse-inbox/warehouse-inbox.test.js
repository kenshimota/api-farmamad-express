const { createInboxService } = require("./service");
const { toPublicInboxLot } = require("./serializer");
const { buildWhere } = require("./repository");
const { resolveListQuery } = require("./query");

const CLOCK = new Date("2026-11-02T15:05:00.000Z");

/**
 * Builds a repository double with the methods used by the service.
 * @returns {object} The repository double.
 */
function repositoryDouble() {
  return {
    transaction: jest.fn((callback) => callback({ id: "tx" })),
    list: jest.fn(),
    findById: jest.fn(),
    findForUpdate: jest.fn(),
    update: jest.fn(async (lot, values) => {
      Object.assign(lot, values);
      return lot;
    }),
    findWarehouse: jest.fn(),
    findShelf: jest.fn(),
    findSection: jest.fn(),
  };
}

/**
 * Builds a lot double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The lot.
 */
function lot(overrides = {}) {
  return {
    id: 40,
    number: "LOTE-1",
    product_id: 15,
    expiration_date: "2027-03-31",
    item_state_id: 1,
    stock: 100,
    reserved: 0,
    location_status: "pending",
    location_started_at: null,
    location_started_by: null,
    located_at: null,
    located_by: null,
    createdAt: CLOCK,
    ...overrides,
  };
}

/**
 * Configures a coherent location chain.
 * @param {object} repository - Repository double.
 * @returns {void}
 */
function validLocation(repository) {
  repository.findWarehouse.mockResolvedValue({ id: 1 });
  repository.findShelf.mockResolvedValue({ id: 2, warehouse_id: 1 });
  repository.findSection.mockResolvedValue({ id: 3, shelf_id: 2 });
}

describe("inbox service startLot", () => {
  it("moves pending to in_progress and stores the audit user", async () => {
    const repository = repositoryDouble();
    const service = createInboxService({ repository, clock: () => CLOCK });
    const pending = lot();

    repository.findForUpdate.mockResolvedValue(pending);
    repository.findById.mockResolvedValue(pending);

    await service.startLot(40, 7);

    expect(repository.update).toHaveBeenCalledWith(
      pending,
      {
        location_status: "in_progress",
        location_started_at: CLOCK,
        location_started_by: 7,
      },
      { id: "tx" },
    );
    expect(repository.findById).toHaveBeenCalledWith(40, {
      transaction: { id: "tx" },
    });
  });

  it("is idempotent for the same user and rejects another user", async () => {
    const repository = repositoryDouble();
    const service = createInboxService({ repository });
    const claimed = lot({
      location_status: "in_progress",
      location_started_by: 7,
    });

    repository.findForUpdate.mockResolvedValue(claimed);
    repository.findById.mockResolvedValue(claimed);

    await expect(service.startLot(40, 7)).resolves.toBe(claimed);
    expect(repository.update).not.toHaveBeenCalled();

    await expect(service.startLot(40, 8)).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot is being located by another user" },
    });
  });

  it("rejects a located lot and a missing lot", async () => {
    const repository = repositoryDouble();
    const service = createInboxService({ repository });

    repository.findForUpdate.mockResolvedValue(
      lot({ location_status: "located" }),
    );
    await expect(service.startLot(40, 7)).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot is already located" },
    });

    repository.findForUpdate.mockResolvedValue(null);
    await expect(service.startLot(99, 7)).rejects.toMatchObject({
      status: 404,
      body: { message: "Lot not found" },
    });
  });
});

describe("inbox service assignLocation", () => {
  it("validates the chain and marks the lot as located", async () => {
    const repository = repositoryDouble();
    const service = createInboxService({ repository, clock: () => CLOCK });
    const pending = lot();

    repository.findForUpdate.mockResolvedValue(pending);
    repository.findById.mockResolvedValue(pending);
    validLocation(repository);

    await service.assignLocation(
      40,
      { warehouse_id: 1, shelf_id: 2, section_id: 3 },
      7,
    );

    expect(repository.update).toHaveBeenCalledWith(
      pending,
      {
        warehouse_id: 1,
        shelf_id: 2,
        section_id: 3,
        location_status: "located",
        located_at: CLOCK,
        located_by: 7,
      },
      { id: "tx" },
    );
  });

  it.each([
    [
      "warehouse_id",
      (repository) => {
        repository.findWarehouse.mockResolvedValue(null);
      },
      { errors: { warehouse_id: "Invalid warehouse id" } },
    ],
    [
      "shelf_id",
      (repository) => {
        repository.findShelf.mockResolvedValue(null);
      },
      { errors: { shelf_id: "Invalid shelf id" } },
    ],
    [
      "section_id",
      (repository) => {
        repository.findSection.mockResolvedValue(null);
      },
      { errors: { section_id: "Invalid section id" } },
    ],
    [
      "shelf_id",
      (repository) => {
        repository.findShelf.mockResolvedValue({ id: 2, warehouse_id: 9 });
      },
      { errors: { shelf_id: "Shelf does not belong to the warehouse" } },
    ],
    [
      "section_id",
      (repository) => {
        repository.findSection.mockResolvedValue({ id: 3, shelf_id: 9 });
      },
      { errors: { section_id: "Section does not belong to the shelf" } },
    ],
  ])("rejects an incoherent %s", async (field, breakChain, body) => {
    const repository = repositoryDouble();
    const service = createInboxService({ repository });

    repository.findForUpdate.mockResolvedValue(lot());
    validLocation(repository);
    breakChain(repository);

    await expect(
      service.assignLocation(
        40,
        { warehouse_id: 1, shelf_id: 2, section_id: 3 },
        7,
      ),
    ).rejects.toMatchObject({ status: 422, body });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects a lot claimed by another user or already located", async () => {
    const repository = repositoryDouble();
    const service = createInboxService({ repository });
    const values = { warehouse_id: 1, shelf_id: 2, section_id: 3 };

    repository.findForUpdate.mockResolvedValue(
      lot({ location_status: "in_progress", location_started_by: 8 }),
    );
    await expect(service.assignLocation(40, values, 7)).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot is being located by another user" },
    });

    repository.findForUpdate.mockResolvedValue(
      lot({ location_status: "located" }),
    );
    await expect(service.assignLocation(40, values, 7)).rejects.toMatchObject({
      status: 409,
      body: { message: "Lot is already located" },
    });
  });
});

describe("inbox serializer and filters", () => {
  it("exposes available as zero until the lot is located", () => {
    const pending = toPublicInboxLot(lot());

    expect(pending.available).toBe(0);
    expect(pending.location_status).toBe("pending");
    expect(pending.created_at).toBe(CLOCK.toISOString());

    const located = toPublicInboxLot(
      lot({
        location_status: "located",
        located_at: CLOCK,
        located_by: 7,
        purchase_items: [
          {
            id: 1,
            purchase_id: 1,
            purchase: { id: 1, number: 1, supplier_id: 2 },
          },
        ],
        started_by: { id: 7, username: "almacen" },
        located_by_user: { id: 7, username: "almacen" },
      }),
    );

    expect(located.available).toBe(100);
    expect(located.purchase).toEqual({ id: 1, number: 1, supplier_id: 2 });
    expect(located.purchase_item_id).toBe(1);
    expect(located.located_by).toEqual({ id: 7, username: "almacen" });
  });

  it("defaults the listing to pending and in_progress", () => {
    expect(buildWhere().location_status).toBeDefined();
    expect(buildWhere({ status: "located" }).location_status).toBe("located");
    expect(buildWhere({ status: "all" })).not.toHaveProperty("location_status");
  });

  it("validates the optional filters before querying", () => {
    expect(resolveListQuery({ product_id: "15" }).filters.productId).toBe(15);
    expect(resolveListQuery({ status: "all" }).filters.status).toBe("all");
    expect(resolveListQuery({ product_id: "abc" }).errors).toEqual({
      product_id: "Invalid product id",
    });
    expect(resolveListQuery({ expiring_before: "2026-02-30" }).errors).toEqual({
      expiring_before: "expiring_before must be a valid date (YYYY-MM-DD)",
    });
  });
});
