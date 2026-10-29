const { LIST_ORDER, createMethodPaymentRepository } = require("./repository");

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
  const typeModel = {
    findByPk: jest.fn().mockResolvedValue({ id: 2 }),
  };
  const currencyModel = {};
  const connection = {
    transaction: jest.fn((callback) => callback()),
  };

  return {
    model,
    typeModel,
    currencyModel,
    connection,
    repository: createMethodPaymentRepository({
      model,
      typeModel,
      currencyModel,
      connection,
    }),
  };
}

describe("method payment repository", () => {
  it("runs callbacks inside a transaction", async () => {
    const { repository, connection } = buildRepository();
    const callback = jest.fn().mockResolvedValue("done");

    await expect(repository.transaction(callback)).resolves.toBe("done");
    expect(connection.transaction).toHaveBeenCalledWith(callback);
  });

  it("creates and reloads with the type and currency", async () => {
    const { repository, model } = buildRepository();
    const values = {
      method_payment_type_id: 1,
      label: "PayPal",
      details: {},
    };

    await expect(
      repository.create(values, { transaction: "tx" }),
    ).resolves.toEqual({ id: 1 });
    expect(model.create).toHaveBeenCalledWith(values, { transaction: "tx" });
    expect(model.findByPk).toHaveBeenCalledWith(1, {
      transaction: "tx",
      include: expect.any(Array),
    });
  });

  it("lists in the documented order and includes the type and currency", async () => {
    const { repository, model } = buildRepository();

    await repository.list();

    expect(LIST_ORDER).toEqual([
      ["method_payment_type_id", "ASC"],
      ["label", "ASC"],
    ]);
    expect(model.findAll).toHaveBeenCalledWith({
      where: {},
      order: LIST_ORDER,
      include: [expect.objectContaining({ as: "method_payment_type" })],
    });
    const include = model.findAll.mock.calls[0][0].include[0];
    expect(include.include).toEqual([
      expect.objectContaining({ as: "currency" }),
    ]);
  });

  it("filters by type, currency and active status", async () => {
    const { repository, model } = buildRepository();

    await repository.list({
      methodPaymentTypeId: 2,
      currencyId: 3,
      isActive: false,
    });

    const options = model.findAll.mock.calls[0][0];
    expect(options.where).toEqual({
      method_payment_type_id: 2,
      is_active: false,
    });
    expect(options.include[0]).toMatchObject({
      as: "method_payment_type",
      required: true,
      where: { currency_id: 3 },
    });
  });

  it("finds one method by id with its relations", async () => {
    const { repository, model } = buildRepository();

    await expect(
      repository.findById(7, { transaction: "tx" }),
    ).resolves.toEqual({ id: 1 });
    expect(model.findByPk).toHaveBeenCalledWith(7, {
      transaction: "tx",
      include: expect.any(Array),
    });
  });

  it("updates and removes the loaded instance", async () => {
    const { repository } = buildRepository();
    const method = {
      id: 1,
      update: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue(),
    };

    await repository.update(method, { label: "Otro" }, { transaction: "tx" });
    expect(method.update).toHaveBeenCalledWith(
      { label: "Otro" },
      { transaction: "tx" },
    );

    await repository.remove(method, { transaction: "tx" });
    expect(method.destroy).toHaveBeenCalledWith({ transaction: "tx" });
  });

  it("loads a type with its currency for validation", async () => {
    const { repository, typeModel } = buildRepository();

    await expect(
      repository.findType(2, { transaction: "tx" }),
    ).resolves.toEqual({ id: 2 });
    expect(typeModel.findByPk).toHaveBeenCalledWith(2, {
      transaction: "tx",
      include: [expect.objectContaining({ as: "currency" })],
    });
  });
});
