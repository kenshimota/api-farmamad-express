const { createCustomerSellerService } = require("./service");

/**
 * Builds a repository double with successful defaults.
 * @returns {object} The repository double.
 */
function buildRepository() {
  return {
    transaction: jest.fn((callback) => callback("tx")),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    findByCustomerId: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(),
    remove: jest.fn().mockResolvedValue(),
    findCustomer: jest.fn().mockResolvedValue({ id: 8 }),
    findSeller: jest
      .fn()
      .mockResolvedValue({
        id: 12,
        isBlocked: false,
        role: { name: "seller" },
      }),
  };
}

/**
 * Builds the service around a repository double.
 * @returns {{ service: object, repository: object }} The pair.
 */
function buildService() {
  const repository = buildRepository();

  return {
    repository,
    service: createCustomerSellerService({ repository }),
  };
}

describe("customer seller service", () => {
  it("lists, loads and removes through the repository", async () => {
    const { service, repository } = buildService();

    await service.listAssignments({ sellerId: 12 });
    expect(repository.list).toHaveBeenCalledWith({ sellerId: 12 });

    await expect(service.getAssignment(3)).resolves.toEqual({ id: 1 });
    expect(repository.findById).toHaveBeenCalledWith(3);

    const assignment = { id: 3 };
    await service.deleteAssignment(assignment);
    expect(repository.remove).toHaveBeenCalledWith(assignment);
  });

  it("creates inside a transaction after validating references", async () => {
    const { service, repository } = buildService();
    repository.findById.mockResolvedValue({ id: 1, seller: { id: 12 } });

    await expect(
      service.createAssignment({ customer_id: 8, seller_id: 12 }),
    ).resolves.toEqual({ id: 1, seller: { id: 12 } });

    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.findCustomer).toHaveBeenCalledWith(8, {
      transaction: "tx",
    });
    expect(repository.findSeller).toHaveBeenCalledWith(12, {
      transaction: "tx",
    });
    expect(repository.findByCustomerId).toHaveBeenCalledWith(8, {
      transaction: "tx",
    });
    expect(repository.create).toHaveBeenCalledWith(
      { customer_id: 8, seller_id: 12 },
      { transaction: "tx" },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      transaction: "tx",
    });
  });

  it("rejects an unknown customer with 422", async () => {
    const { service, repository } = buildService();
    repository.findCustomer.mockResolvedValue(null);

    await expect(
      service.createAssignment({ customer_id: 99, seller_id: 12 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { customer_id: "Invalid customer" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["without seller role", { id: 12, role: { name: "admin" } }],
    ["without role", { id: 12 }],
    ["blocked", { id: 12, isBlocked: true, role: { name: "seller" } }],
  ])("rejects a seller that is %s with 422", async (_label, seller) => {
    const { service, repository } = buildService();
    repository.findSeller.mockResolvedValue(seller);

    await expect(
      service.createAssignment({ customer_id: 8, seller_id: 12 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { seller_id: "Invalid seller" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a customer that already has a seller with 409", async () => {
    const { service, repository } = buildService();
    repository.findByCustomerId.mockResolvedValue({ id: 1 });

    await expect(
      service.createAssignment({ customer_id: 8, seller_id: 12 }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Customer already has a seller" },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("reassigns the seller and refreshes assigned_at inside a transaction", async () => {
    const { service, repository } = buildService();
    const assignment = { id: 1, customer_id: 8, seller_id: 12 };
    repository.findById.mockResolvedValue({ ...assignment, seller_id: 15 });

    await service.updateAssignment(assignment, { seller_id: 15 });

    expect(repository.findSeller).toHaveBeenCalledWith(15, {
      transaction: "tx",
    });
    expect(repository.update).toHaveBeenCalledWith(
      assignment,
      { seller_id: 15, assigned_at: expect.any(Date) },
      { transaction: "tx" },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      transaction: "tx",
    });
  });

  it("validates the new seller before reassigning", async () => {
    const { service, repository } = buildService();
    repository.findSeller.mockResolvedValue({ id: 15, isBlocked: true });

    await expect(
      service.updateAssignment(
        { id: 1, customer_id: 8, seller_id: 12 },
        { seller_id: 15 },
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { seller_id: "Invalid seller" } },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
