const { Op } = require("sequelize");
const { LIST_ORDER, createPaymentRepository } = require("./repository");

/**
 * Builds the model doubles and the repository around them.
 * @returns {object} The repository and doubles.
 */
function buildRepository() {
  const model = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const walletModel = {
    bulkCreate: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 5, balance: "0.00" }),
    findByPk: jest.fn().mockResolvedValue({ id: 5, balance: "0.00" }),
  };
  const transactionModel = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
    count: jest.fn().mockResolvedValue(0),
  };
  const customerModel = { findByPk: jest.fn().mockResolvedValue({ id: 8 }) };
  const methodModel = { findByPk: jest.fn().mockResolvedValue({ id: 3 }) };
  const connection = {
    transaction: jest.fn((callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } }),
    ),
  };

  return {
    connection,
    customerModel,
    methodModel,
    model,
    transactionModel,
    walletModel,
    repository: createPaymentRepository({
      model,
      walletModel,
      transactionModel,
      customerModel,
      methodModel,
      typeModel: {},
      currencyModel: {},
      connection,
    }),
  };
}

describe("payment repository", () => {
  it("runs callbacks inside a transaction", async () => {
    const { repository, connection } = buildRepository();

    await expect(repository.transaction(async () => "done")).resolves.toBe(
      "done",
    );
    expect(connection.transaction).toHaveBeenCalledTimes(1);
  });

  it("finds one payment with method and currency", async () => {
    const { repository, model } = buildRepository();

    await repository.findById(1, { transaction: "tx" });

    expect(model.findByPk).toHaveBeenCalledWith(1, {
      transaction: "tx",
      include: expect.any(Array),
    });
    expect(model.findByPk.mock.calls[0][1].include).toHaveLength(2);
  });

  it("lists with the documented order and every filter", async () => {
    const { repository, model } = buildRepository();
    const from = new Date("2026-11-01T00:00:00.000Z");
    const to = new Date("2026-11-02T00:00:00.000Z");

    await repository.list({
      customerId: 8,
      methodPaymentId: 3,
      currencyId: 2,
      paidFrom: from,
      paidTo: to,
    });

    expect(LIST_ORDER).toEqual([
      ["paid_at", "DESC"],
      ["id", "DESC"],
    ]);
    expect(model.findAll).toHaveBeenCalledWith({
      where: {
        customer_id: 8,
        method_payment_id: 3,
        currency_id: 2,
        paid_at: { [Op.gte]: from, [Op.lt]: to },
      },
      order: LIST_ORDER,
      include: expect.any(Array),
    });
  });

  it("lists without filters and with a single date bound", async () => {
    const { repository, model } = buildRepository();
    const from = new Date("2026-11-01T00:00:00.000Z");
    const to = new Date("2026-11-02T00:00:00.000Z");

    await repository.list();
    expect(model.findAll.mock.calls[0][0].where).toEqual({});

    await repository.list({ paidFrom: from });
    expect(model.findAll.mock.calls[1][0].where).toEqual({
      paid_at: { [Op.gte]: from },
    });

    await repository.list({ paidTo: to });
    expect(model.findAll.mock.calls[2][0].where).toEqual({
      paid_at: { [Op.lt]: to },
    });
  });

  it("creates and reloads the payment", async () => {
    const { repository, model } = buildRepository();

    await repository.create({ customer_id: 8 }, { transaction: "tx" });

    expect(model.create).toHaveBeenCalledWith(
      { customer_id: 8 },
      { transaction: "tx" },
    );
    expect(model.findByPk).toHaveBeenCalledWith(1, {
      transaction: "tx",
      include: expect.any(Array),
    });
  });

  it("updates and removes a loaded payment", async () => {
    const { repository } = buildRepository();
    const payment = {
      update: jest.fn(),
      destroy: jest.fn(),
    };

    await repository.update(payment, { notes: "x" }, { transaction: "tx" });
    await repository.remove(payment, { transaction: "tx" });

    expect(payment.update).toHaveBeenCalledWith(
      { notes: "x" },
      { transaction: "tx" },
    );
    expect(payment.destroy).toHaveBeenCalledWith({ transaction: "tx" });
  });

  it("loads the customer and the method with its type and currency", async () => {
    const { repository, customerModel, methodModel } = buildRepository();

    await repository.findCustomer(8, { transaction: "tx" });
    await repository.findMethod(3, { transaction: "tx" });

    expect(customerModel.findByPk).toHaveBeenCalledWith(8, {
      transaction: "tx",
    });
    const options = methodModel.findByPk.mock.calls[0][1];
    expect(options.include[0]).toMatchObject({
      as: "method_payment_type",
    });
    expect(options.include[0].include[0]).toMatchObject({
      as: "currency",
    });
  });

  it("inserts the wallet ignoring duplicates and locks the row", async () => {
    const { repository, walletModel } = buildRepository();
    const transaction = { LOCK: { UPDATE: "UPDATE" } };

    await repository.findOrCreateWallet(8, 2, { transaction });

    expect(walletModel.bulkCreate).toHaveBeenCalledWith(
      [{ customer_id: 8, currency_id: 2, balance: 0 }],
      { ignoreDuplicates: true, transaction },
    );
    expect(walletModel.findOne).toHaveBeenCalledWith({
      where: { customer_id: 8, currency_id: 2 },
      transaction,
      lock: "UPDATE",
    });
  });

  it("increments the balance atomically and reloads the wallet", async () => {
    const { repository } = buildRepository();
    const wallet = {
      balance: "0.00",
      increment: jest.fn(),
      reload: jest.fn().mockResolvedValue({ id: 5, balance: "100.00" }),
    };

    await expect(
      repository.incrementBalance(wallet, 100, { transaction: "tx" }),
    ).resolves.toMatchObject({ balance: "100.00" });
    expect(wallet.increment).toHaveBeenCalledWith("balance", {
      by: 100,
      transaction: "tx",
    });
  });

  it("appends and removes movements and finds the deposit", async () => {
    const { repository, transactionModel } = buildRepository();
    const movement = { destroy: jest.fn() };

    await repository.createWalletTransaction(
      { amount: 100 },
      { transaction: "tx" },
    );
    await repository.findDeposit(1, { transaction: { LOCK: { UPDATE: "U" } } });
    await repository.removeWalletTransaction(movement, { transaction: "tx" });

    expect(transactionModel.create).toHaveBeenCalledWith(
      { amount: 100 },
      { transaction: "tx" },
    );
    expect(transactionModel.findOne).toHaveBeenCalledWith({
      where: { payment_id: 1, transaction_type: "deposit" },
      transaction: { LOCK: { UPDATE: "U" } },
      lock: "U",
    });
    expect(movement.destroy).toHaveBeenCalledWith({ transaction: "tx" });
  });

  it("counts invoice allocations", async () => {
    const { repository, transactionModel } = buildRepository();

    await expect(repository.countAllocations(1)).resolves.toBe(0);

    expect(transactionModel.count).toHaveBeenCalledWith({
      where: {
        payment_id: 1,
        [Op.or]: [
          { transaction_type: "invoice_payment" },
          { payment_allocation_id: { [Op.ne]: null } },
        ],
      },
    });
  });
});
