const { Op } = require("sequelize");
const {
  ALLOCATION_STATUSES,
  DEFAULT_ALLOCATION_STATUSES,
  createPickingRepository,
  resolveAllocationStatuses,
} = require("./picking-repository");

/**
 * Builds an order model double exposing only the finder used by the picking
 * repository.
 * @returns {object} The model double.
 */
function modelDouble() {
  return { findByPk: jest.fn().mockResolvedValue({ id: 10 }) };
}

/**
 * Builds a repository with an injected model double.
 * @returns {{ repository: object, model: object }} The repository and double.
 */
function setup() {
  const model = modelDouble();
  const repository = createPickingRepository({ model });

  return { repository, model };
}

describe("picking repository", () => {
  it("includes reserved and consumed allocations by default", () => {
    expect(DEFAULT_ALLOCATION_STATUSES).toEqual(["reserved", "consumed"]);
    expect(ALLOCATION_STATUSES).toEqual(["reserved", "consumed", "released"]);
    expect(resolveAllocationStatuses()).toEqual(["reserved", "consumed"]);
    expect(resolveAllocationStatuses("released")).toEqual(["released"]);
    expect(resolveAllocationStatuses("all")).toEqual([
      "reserved",
      "consumed",
      "released",
    ]);
  });

  it("loads the order with one nested include tree", async () => {
    const { repository, model } = setup();

    await repository.findOrderById(10);

    expect(model.findByPk).toHaveBeenCalledTimes(1);
    const options = model.findByPk.mock.calls[0][1];
    const customer = options.include.find(
      (include) => include.as === "customer",
    );
    const items = options.include.find((include) => include.as === "items");
    const allocations = items.include.find(
      (include) => include.as === "allocations",
    );
    const lot = allocations.include.find((include) => include.as === "lot");

    expect(customer).toBeDefined();
    expect(items).toBeDefined();
    expect(allocations).toMatchObject({ required: false });
    expect(allocations.where.status[Op.in]).toEqual(["reserved", "consumed"]);
    expect(lot).toBeDefined();
    expect(lot.include.map((include) => include.as).sort()).toEqual([
      "section",
      "shelf",
      "warehouse",
    ]);
  });

  it("passes an explicit allocation status filter to the query", async () => {
    const { repository, model } = setup();

    await repository.findOrderById(10, { allocationStatus: "released" });

    const options = model.findByPk.mock.calls[0][1];
    const items = options.include.find((include) => include.as === "items");
    const allocations = items.include.find(
      (include) => include.as === "allocations",
    );

    expect(allocations.where.status[Op.in]).toEqual(["released"]);
  });
});
