const { LIST_ORDER, createTaxRepository } = require("./repository");

/**
 * Builds the model double and the repository around it.
 * @returns {{ repository: object, model: object }} The repository and model.
 */
function buildRepository() {
  const model = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const db = { transaction: jest.fn() };

  return {
    model,
    repository: createTaxRepository({ model, db }),
  };
}

describe("tax repository", () => {
  it("creates a tax", async () => {
    const { repository, model } = buildRepository();
    const values = {
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
    };

    await expect(repository.create(values, { tx: true })).resolves.toEqual({
      id: 1,
    });
    expect(model.create).toHaveBeenCalledWith(values, { tx: true });
  });

  it("lists every tax ordered by code when no filter is given", async () => {
    const { repository, model } = buildRepository();

    await repository.list();

    expect(model.findAll).toHaveBeenCalledWith({ order: LIST_ORDER });
    expect(LIST_ORDER).toEqual([["code", "ASC"]]);
  });

  it.each([true, false])(
    "filters by is_active=%p when provided",
    async (isActive) => {
      const { repository, model } = buildRepository();

      await repository.list({ isActive });

      expect(model.findAll).toHaveBeenCalledWith({
        order: LIST_ORDER,
        where: { is_active: isActive },
      });
    },
  );

  it("finds a tax by id", async () => {
    const { repository, model } = buildRepository();

    await expect(repository.findById(7, { tx: true })).resolves.toEqual({
      id: 1,
    });
    expect(model.findByPk).toHaveBeenCalledWith(7, { tx: true });
  });

  it("updates and removes a loaded tax", async () => {
    const { repository } = buildRepository();
    const tax = {
      update: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue(),
    };

    await repository.update(tax, { rate: 3.5 }, { tx: true });
    expect(tax.update).toHaveBeenCalledWith({ rate: 3.5 }, { tx: true });

    await repository.remove(tax, { tx: true });
    expect(tax.destroy).toHaveBeenCalledWith({ tx: true });
  });
});
