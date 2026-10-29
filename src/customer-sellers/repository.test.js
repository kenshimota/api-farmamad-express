const {
  CUSTOMER_SELLER_INCLUDES,
  LIST_ORDER,
  createCustomerSellerRepository,
} = require("./repository");

/**
 * Builds model doubles and a repository around them.
 * @returns {object} The repository and its doubles.
 */
function buildRepository() {
  const model = {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };
  const customerModel = { findByPk: jest.fn() };
  const sellerModel = { findByPk: jest.fn() };
  const roleModel = { name: "Role" };
  const connection = { transaction: jest.fn() };
  const repository = createCustomerSellerRepository({
    model,
    customerModel,
    sellerModel,
    roleModel,
    connection,
  });

  return {
    repository,
    model,
    customerModel,
    sellerModel,
    roleModel,
    connection,
  };
}

describe("customer seller repository", () => {
  it("delegates transactions, create and includes the relations on find", async () => {
    const { repository, model, connection } = buildRepository();
    const callback = jest.fn();
    connection.transaction.mockReturnValue("transaction result");
    model.create.mockResolvedValue({ id: 1 });
    model.findByPk.mockResolvedValue({ id: 1 });

    expect(repository.transaction(callback)).toBe("transaction result");
    expect(connection.transaction).toHaveBeenCalledWith(callback);

    await repository.create({ customer_id: 8, seller_id: 12 }, { tx: true });
    expect(model.create).toHaveBeenCalledWith(
      { customer_id: 8, seller_id: 12 },
      { tx: true },
    );

    await repository.findById(1, { transaction: "tx" });
    expect(model.findByPk).toHaveBeenCalledWith(1, {
      transaction: "tx",
      include: CUSTOMER_SELLER_INCLUDES,
    });
    expect(CUSTOMER_SELLER_INCLUDES.map((include) => include.as)).toEqual([
      "customer",
      "seller",
    ]);
  });

  it("finds the assignment of one customer", async () => {
    const { repository, model } = buildRepository();

    await repository.findByCustomerId(8, { transaction: "tx" });

    expect(model.findOne).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      transaction: "tx",
    });
  });

  it("lists with optional filters ordered by customer_id and includes relations", async () => {
    const { repository, model } = buildRepository();

    await repository.list();
    expect(model.findAll).toHaveBeenLastCalledWith({
      where: {},
      order: LIST_ORDER,
      include: CUSTOMER_SELLER_INCLUDES,
    });

    await repository.list({ customerId: 8, sellerId: 12 });
    expect(model.findAll).toHaveBeenLastCalledWith({
      where: { customer_id: 8, seller_id: 12 },
      order: LIST_ORDER,
      include: CUSTOMER_SELLER_INCLUDES,
    });
    expect(LIST_ORDER).toEqual([["customer_id", "ASC"]]);
  });

  it("updates and removes an existing assignment", async () => {
    const { repository } = buildRepository();
    const assignment = {
      update: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue(),
    };

    await repository.update(
      assignment,
      { seller_id: 15 },
      { transaction: "tx" },
    );
    expect(assignment.update).toHaveBeenCalledWith(
      { seller_id: 15 },
      { transaction: "tx" },
    );

    await repository.remove(assignment, { transaction: "tx" });
    expect(assignment.destroy).toHaveBeenCalledWith({ transaction: "tx" });
  });

  it("loads customers and sellers, including the seller role", async () => {
    const { repository, customerModel, sellerModel, roleModel } =
      buildRepository();
    customerModel.findByPk.mockResolvedValue({ id: 8 });
    sellerModel.findByPk.mockResolvedValue({ id: 12 });

    await expect(
      repository.findCustomer(8, { transaction: "tx" }),
    ).resolves.toEqual({ id: 8 });
    expect(customerModel.findByPk).toHaveBeenCalledWith(8, {
      transaction: "tx",
    });

    await expect(
      repository.findSeller(12, { transaction: "tx" }),
    ).resolves.toEqual({ id: 12 });
    expect(sellerModel.findByPk).toHaveBeenCalledWith(12, {
      transaction: "tx",
      include: [{ model: roleModel, as: "role", attributes: ["name"] }],
    });
  });
});
