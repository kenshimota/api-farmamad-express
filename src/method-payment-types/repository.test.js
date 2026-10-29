const {
  LIST_ORDER,
  createMethodPaymentTypeRepository,
} = require("./repository");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");

/**
 * Builds the model doubles and the repository around them.
 * @param {object} [options] - Injectable options.
 * @param {Function} [options.loader] - Method payment model loader.
 * @returns {{ repository: object, model: object, currencyModel: object }}
 *   The repository and its doubles.
 */
function buildRepository({ loader } = {}) {
  const model = {
    create: jest.fn(async (values) => ({ id: 1, ...values })),
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue({ id: 1, currency: null }),
  };
  const currencyModel = {
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const repository = createMethodPaymentTypeRepository({
    model,
    currencyModel,
    methodPaymentLoader: loader,
  });

  return { repository, model, currencyModel };
}

describe("method payment type repository", () => {
  it("creates a type and reloads it with the currency", async () => {
    const { repository, model } = buildRepository();
    const values = { code: "PAYPAL", name: "PayPal", currency_id: 3 };

    await expect(repository.create(values)).resolves.toEqual({
      id: 1,
      currency: null,
    });
    expect(model.create).toHaveBeenCalledWith(values);
    expect(model.findByPk).toHaveBeenCalledWith(1, {
      include: [
        {
          model: expect.anything(),
          as: "currency",
          attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
        },
      ],
    });
  });

  it("lists types ordered by code and includes the currency", async () => {
    const { repository, model } = buildRepository();

    await repository.list();

    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [
        {
          model: expect.anything(),
          as: "currency",
          attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
        },
      ],
    });
    expect(LIST_ORDER).toEqual([["code", "ASC"]]);
  });

  it("applies the currency_id and is_active filters together", async () => {
    const { repository, model } = buildRepository();

    await repository.list({ currencyId: 5, isActive: false });

    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: [
        {
          model: expect.anything(),
          as: "currency",
          attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
        },
      ],
      where: { currency_id: 5, is_active: false },
    });
  });

  it("finds a type by id with the currency include", async () => {
    const { repository, model } = buildRepository();

    await expect(repository.findById(7)).resolves.toEqual({
      id: 1,
      currency: null,
    });
    expect(model.findByPk).toHaveBeenCalledWith(7, {
      include: [
        {
          model: expect.anything(),
          as: "currency",
          attributes: [...CURRENCY_SUMMARY_ATTRIBUTES],
        },
      ],
    });
  });

  it("updates a loaded type and reloads it", async () => {
    const { repository } = buildRepository();
    const type = {
      id: 1,
      update: jest.fn().mockResolvedValue(),
    };

    await expect(repository.update(type, { name: "Banco" })).resolves.toEqual({
      id: 1,
      currency: null,
    });
    expect(type.update).toHaveBeenCalledWith({ name: "Banco" });
  });

  it("removes a loaded type", async () => {
    const { repository } = buildRepository();
    const type = { destroy: jest.fn().mockResolvedValue() };

    await repository.remove(type);

    expect(type.destroy).toHaveBeenCalledTimes(1);
  });

  it("finds an active currency", async () => {
    const { repository, currencyModel } = buildRepository();

    await expect(repository.findActiveCurrency(3)).resolves.toEqual({ id: 1 });
    expect(currencyModel.findOne).toHaveBeenCalledWith({
      where: { id: 3, is_active: true },
    });
  });

  it("counts zero methods when the MethodPayment model does not exist", async () => {
    const { repository } = buildRepository({ loader: () => null });

    await expect(repository.countMethods(1)).resolves.toBe(0);
  });

  it("counts methods by method_payment_type_id when declared", async () => {
    const methodPaymentModel = {
      getAttributes: jest.fn(() => ({ method_payment_type_id: {} })),
      count: jest.fn().mockResolvedValue(2),
    };
    const { repository } = buildRepository({
      loader: () => methodPaymentModel,
    });

    await expect(repository.countMethods(4)).resolves.toBe(2);
    expect(methodPaymentModel.count).toHaveBeenCalledWith({
      where: { method_payment_type_id: 4 },
    });
  });

  it("counts methods by type_id when that is the declared column", async () => {
    const methodPaymentModel = {
      getAttributes: jest.fn(() => ({ type_id: {} })),
      count: jest.fn().mockResolvedValue(3),
    };
    const { repository } = buildRepository({
      loader: () => methodPaymentModel,
    });

    await expect(repository.countMethods(9)).resolves.toBe(3);
    expect(methodPaymentModel.count).toHaveBeenCalledWith({
      where: { type_id: 9 },
    });
  });

  it("counts zero when the model declares no known foreign key", async () => {
    const methodPaymentModel = {
      getAttributes: jest.fn(() => ({ id: {} })),
      count: jest.fn(),
    };
    const { repository } = buildRepository({
      loader: () => methodPaymentModel,
    });

    await expect(repository.countMethods(9)).resolves.toBe(0);
    expect(methodPaymentModel.count).not.toHaveBeenCalled();
  });
});
