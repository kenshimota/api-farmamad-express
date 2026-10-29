const { createTaxService } = require("./service");

/**
 * Builds a repository double with successful defaults.
 * @returns {object} The repository double.
 */
function buildRepository() {
  return {
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    create: jest.fn(async (values) => ({ id: 1, ...values })),
    update: jest.fn(async (tax, values) => ({ ...tax, ...values })),
    remove: jest.fn().mockResolvedValue(),
  };
}

describe("tax service", () => {
  it("delegates list, detail and delete", async () => {
    const repository = buildRepository();
    const service = createTaxService({ repository });
    const tax = { id: 1 };

    await expect(service.listTaxes({ isActive: true })).resolves.toEqual([]);
    await expect(service.getTax(1)).resolves.toEqual({ id: 1 });
    await expect(service.deleteTax(tax)).resolves.toBeUndefined();

    expect(repository.list).toHaveBeenCalledWith({ isActive: true });
    expect(repository.findById).toHaveBeenCalledWith(1);
    expect(repository.remove).toHaveBeenCalledWith(tax);
  });

  it("creates the tax with an uppercase code and the documented defaults", async () => {
    const repository = buildRepository();
    const service = createTaxService({ repository });

    await expect(
      service.createTax({
        code: "iva",
        name: "Impuesto al Valor Agregado",
        rate: 16,
      }),
    ).resolves.toEqual({
      id: 1,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: null,
      is_active: true,
    });

    expect(repository.create).toHaveBeenCalledWith({
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: null,
      is_active: true,
    });
  });

  it("keeps an explicit false is_active and an explicit description", async () => {
    const repository = buildRepository();
    const service = createTaxService({ repository });

    await service.createTax({
      code: "IGTF",
      name: "IGTF",
      rate: 3,
      description: "General",
      is_active: false,
    });

    expect(repository.create).toHaveBeenCalledWith({
      code: "IGTF",
      name: "IGTF",
      rate: 3,
      description: "General",
      is_active: false,
    });
  });

  it("updates only the editable fields and ignores code and id", async () => {
    const repository = buildRepository();
    const service = createTaxService({ repository });
    const tax = { id: 1, code: "IVA", name: "IVA", rate: 16 };

    await expect(
      service.updateTax(tax, {
        code: "OTHER",
        id: 99,
        rate: 3.5,
        is_active: false,
        name: undefined,
      }),
    ).resolves.toEqual({
      id: 1,
      code: "IVA",
      name: "IVA",
      rate: 3.5,
      is_active: false,
    });

    expect(repository.update).toHaveBeenCalledWith(tax, {
      rate: 3.5,
      is_active: false,
    });
  });
});
