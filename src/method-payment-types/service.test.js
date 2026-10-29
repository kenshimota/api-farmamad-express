const { createMethodPaymentTypeService } = require("./service");

const FIELD = Object.freeze({
  key: "email",
  label: "Correo de PayPal",
  type: "email",
  required: true,
});

/**
 * Builds a repository double with successful defaults.
 * @returns {object} The repository double.
 */
function buildRepository() {
  return {
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    create: jest.fn(async (values) => ({ id: 1, ...values })),
    update: jest.fn(async (type, values) => ({ ...type, ...values })),
    remove: jest.fn().mockResolvedValue(),
    findActiveCurrency: jest.fn().mockResolvedValue({ id: 3 }),
    countMethods: jest.fn().mockResolvedValue(0),
  };
}

/**
 * Builds a stored type double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The type double.
 */
function storedType(overrides = {}) {
  return {
    id: 1,
    code: "PAYPAL",
    name: "PayPal",
    currency_id: 3,
    fields: [FIELD],
    description: null,
    is_active: true,
    ...overrides,
  };
}

describe("method payment type service", () => {
  it("delegates list and detail", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentTypeService({ repository });

    await expect(
      service.listMethodPaymentTypes({ currencyId: 3, isActive: true }),
    ).resolves.toEqual([]);
    await expect(service.getMethodPaymentType(1)).resolves.toEqual({ id: 1 });

    expect(repository.list).toHaveBeenCalledWith({
      currencyId: 3,
      isActive: true,
    });
    expect(repository.findById).toHaveBeenCalledWith(1);
  });

  it("creates the type with an uppercase code and documented defaults", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentTypeService({ repository });

    await expect(
      service.createMethodPaymentType({
        code: "paypal",
        name: "PayPal",
        currency_id: 3,
        fields: [FIELD],
      }),
    ).resolves.toEqual({
      id: 1,
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      fields: [FIELD],
      description: null,
      is_active: true,
    });

    expect(repository.findActiveCurrency).toHaveBeenCalledWith(3);
    expect(repository.create).toHaveBeenCalledWith({
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
      fields: [FIELD],
      description: null,
      is_active: true,
    });
  });

  it("defaults fields to [] and keeps an explicit is_active false", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentTypeService({ repository });

    await service.createMethodPaymentType({
      code: "BANK",
      name: "Banco",
      currency_id: 3,
      is_active: false,
    });

    expect(repository.create).toHaveBeenCalledWith({
      code: "BANK",
      name: "Banco",
      currency_id: 3,
      fields: [],
      description: null,
      is_active: false,
    });
  });

  it("rejects a missing or inactive currency with 422", async () => {
    const repository = buildRepository();
    repository.findActiveCurrency.mockResolvedValue(null);
    const service = createMethodPaymentTypeService({ repository });

    await expect(
      service.createMethodPaymentType({
        code: "PAYPAL",
        name: "PayPal",
        currency_id: 99,
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { currency_id: "Invalid currency" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("updates editable fields and ignores code", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await expect(
      service.updateMethodPaymentType(type, {
        code: "OTHER",
        name: "PayPal actualizado",
        is_active: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        name: "PayPal actualizado",
        is_active: false,
      }),
    );

    expect(repository.update).toHaveBeenCalledWith(type, {
      name: "PayPal actualizado",
      is_active: false,
    });
  });

  it("allows changing currency_id and fields when there are no methods", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();
    const fields = [{ ...FIELD, required: false }];

    await service.updateMethodPaymentType(type, {
      currency_id: 4,
      fields,
    });

    expect(repository.findActiveCurrency).toHaveBeenCalledWith(4);
    expect(repository.update).toHaveBeenCalledWith(type, {
      currency_id: 4,
      fields,
    });
  });

  it("rejects changing currency_id when the type has methods", async () => {
    const repository = buildRepository();
    repository.countMethods.mockResolvedValue(2);
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await expect(
      service.updateMethodPaymentType(type, { currency_id: 4 }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Payment type has methods" },
    });
    expect(repository.findActiveCurrency).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects changing fields when the type has methods", async () => {
    const repository = buildRepository();
    repository.countMethods.mockResolvedValue(2);
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await expect(
      service.updateMethodPaymentType(type, {
        fields: [{ ...FIELD, required: false }],
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Payment type has methods" },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows the current currency_id and fields even when there are methods", async () => {
    const repository = buildRepository();
    repository.countMethods.mockResolvedValue(2);
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await service.updateMethodPaymentType(type, {
      name: "PayPal",
      currency_id: 3,
      fields: [{ ...FIELD }],
    });

    expect(repository.update).toHaveBeenCalledWith(type, { name: "PayPal" });
  });

  it("rejects an inactive new currency on update with 422", async () => {
    const repository = buildRepository();
    repository.findActiveCurrency.mockResolvedValue(null);
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await expect(
      service.updateMethodPaymentType(type, { currency_id: 4 }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { currency_id: "Invalid currency" } },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("deletes a type without methods", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await expect(
      service.deleteMethodPaymentType(type),
    ).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(type);
  });

  it("rejects deleting a type with methods", async () => {
    const repository = buildRepository();
    repository.countMethods.mockResolvedValue(1);
    const service = createMethodPaymentTypeService({ repository });
    const type = storedType();

    await expect(service.deleteMethodPaymentType(type)).rejects.toMatchObject({
      status: 409,
      body: { message: "Payment type has methods" },
    });
    expect(repository.remove).not.toHaveBeenCalled();
  });
});
