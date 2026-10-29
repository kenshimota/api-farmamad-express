const { createMethodPaymentService } = require("./service");
const {
  CURRENCY,
  PAYPAL_FIELDS,
  TRANSACTION,
  buildRepository,
} = require("../../test/helpers/method-payments-service-fixtures");

describe("method payment service reads", () => {
  it("delegates list and detail", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });

    await expect(
      service.listMethodPayments({ isActive: true }),
    ).resolves.toHaveLength(1);
    await expect(service.getMethodPayment(1)).resolves.toMatchObject({
      id: 1,
    });

    expect(repository.list).toHaveBeenCalledWith({ isActive: true });
    expect(repository.findById).toHaveBeenCalledWith(1);
  });
});

describe("method payment service create", () => {
  it("creates inside a transaction after validating the type and details", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });

    await expect(
      service.createMethodPayment({
        method_payment_type_id: 1,
        label: "PayPal Farmamad",
        details: { email: "pagos@farmamad.com" },
        is_active: true,
      }),
    ).resolves.toMatchObject({ id: 1 });

    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.findType).toHaveBeenCalledWith(1, {
      transaction: TRANSACTION,
    });
    expect(repository.create).toHaveBeenCalledWith(
      {
        method_payment_type_id: 1,
        label: "PayPal Farmamad",
        details: { email: "pagos@farmamad.com" },
        is_active: true,
      },
      { transaction: TRANSACTION },
    );
  });

  it("normalizes details with trim before persisting", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });

    await service.createMethodPayment({
      method_payment_type_id: 1,
      label: "PayPal",
      details: { email: "  pagos@farmamad.com  " },
      is_active: true,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { email: "pagos@farmamad.com" },
      }),
      { transaction: TRANSACTION },
    );
  });

  it.each([
    ["missing", null],
    ["inactive", { is_active: false }],
    ["currency inactive", { currency: { ...CURRENCY, is_active: false } }],
  ])("rejects a %s type with 422", async (_name, overrides) => {
    const repository = buildRepository();
    repository.findType.mockResolvedValue(
      overrides === null
        ? null
        : {
            id: 1,
            fields: PAYPAL_FIELDS,
            is_active: true,
            currency: CURRENCY,
            ...overrides,
          },
    );
    const service = createMethodPaymentService({ repository });

    await expect(
      service.createMethodPayment({
        method_payment_type_id: 1,
        label: "PayPal",
        details: { email: "pagos@farmamad.com" },
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { method_payment_type_id: "Invalid payment type" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects details missing a required key with a field error", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });

    await expect(
      service.createMethodPayment({
        method_payment_type_id: 1,
        label: "PayPal",
        details: {},
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { "details.email": "email is required" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
