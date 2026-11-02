const { createOrderRepository } = require("./repository");

/**
 * Builds a Sequelize model double.
 * @returns {object} The model double.
 */
function modelDouble() {
  return {
    findByPk: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
  };
}

/**
 * Builds a repository with model and connection doubles.
 * @returns {object} The repository and its doubles.
 */
function setup() {
  const model = modelDouble();
  const itemModel = modelDouble();
  const allocationModel = modelDouble();
  const historyModel = modelDouble();
  const userModel = modelDouble();
  const customerModel = modelDouble();
  const lotModel = modelDouble();
  const db = {
    transaction: jest.fn((callback) => callback({ id: "tx" })),
    query: jest.fn().mockResolvedValue([{ number: "42" }]),
  };
  const repository = createOrderRepository({
    model,
    itemModel,
    allocationModel,
    historyModel,
    userModel,
    customerModel,
    lotModel,
    db,
  });

  return {
    repository,
    model,
    itemModel,
    allocationModel,
    historyModel,
    userModel,
    customerModel,
    lotModel,
    db,
  };
}

describe("order repository", () => {
  it("delegates the transaction and loads users and customers", async () => {
    const doubles = setup();
    const callback = jest.fn().mockResolvedValue("ok");
    doubles.userModel.findByPk.mockResolvedValue({ id: 12 });
    doubles.customerModel.findByPk.mockResolvedValue({ id: 8 });

    await expect(doubles.repository.transaction(callback)).resolves.toBe("ok");
    await expect(doubles.repository.findUserById(12)).resolves.toEqual({
      id: 12,
    });
    await expect(doubles.repository.findCustomerById(8)).resolves.toEqual({
      id: 8,
    });
    expect(doubles.db.transaction).toHaveBeenCalledWith(callback);
    expect(doubles.userModel.findByPk).toHaveBeenCalledWith(12);
    expect(doubles.customerModel.findByPk).toHaveBeenCalledWith(8);
  });

  it("loads an order with customer, currency, items and history", async () => {
    const doubles = setup();

    await doubles.repository.findById(10, { transaction: "tx" });

    expect(doubles.model.findByPk).toHaveBeenCalledWith(10, {
      include: [
        expect.objectContaining({ as: "customer" }),
        expect.objectContaining({ as: "currency" }),
        expect.objectContaining({ as: "items", separate: true }),
        expect.objectContaining({ as: "history", separate: true }),
      ],
      transaction: "tx",
    });
  });

  it("reserves the next number from the PostgreSQL sequence", async () => {
    const doubles = setup();

    await expect(doubles.repository.nextNumber("tx")).resolves.toBe(42);
    expect(doubles.db.query).toHaveBeenCalledWith(
      "SELECT nextval('orders_number_seq') AS \"number\"",
      { type: expect.any(String), transaction: "tx" },
    );
  });

  it("loads and locks only the available lots ordered FEFO", async () => {
    const doubles = setup();
    const transaction = { LOCK: { UPDATE: "UPDATE" } };

    await doubles.repository.findLotsForUpdate(15, 1, transaction);

    expect(doubles.lotModel.findAll).toHaveBeenCalledWith({
      where: {
        product_id: 15,
        item_state_id: 1,
        stock: { [Symbol.for("gt")]: expect.anything() },
      },
      order: [
        ["expiration_date", "ASC"],
        ["id", "ASC"],
      ],
      lock: "UPDATE",
      transaction,
    });
  });

  it("increments the reserved units of a locked lot", async () => {
    const doubles = setup();
    const lot = { reserved: 3, update: jest.fn().mockResolvedValue("lot") };

    await expect(doubles.repository.reserveLot(lot, 2, "tx")).resolves.toBe(
      "lot",
    );
    expect(lot.update).toHaveBeenCalledWith(
      { reserved: 5 },
      { transaction: "tx" },
    );
  });

  it("persists the header, lines, allocations and history", async () => {
    const doubles = setup();
    const options = { transaction: "tx" };

    doubles.repository.createOrder({ number: 1 }, options);
    doubles.repository.createItems([{ quantity: 1 }], options);
    doubles.repository.createAllocations([{ lot_id: 1 }], options);
    doubles.repository.createHistory({ event_type: "created" }, options);

    expect(doubles.model.create).toHaveBeenCalledWith({ number: 1 }, options);
    expect(doubles.itemModel.bulkCreate).toHaveBeenCalledWith(
      [{ quantity: 1 }],
      options,
    );
    expect(doubles.allocationModel.bulkCreate).toHaveBeenCalledWith(
      [{ lot_id: 1 }],
      options,
    );
    expect(doubles.historyModel.create).toHaveBeenCalledWith(
      { event_type: "created" },
      options,
    );
  });
});
