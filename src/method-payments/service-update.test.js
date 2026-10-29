const { createMethodPaymentService } = require("./service");
const {
  CURRENCY,
  PAYPAL_FIELDS,
  TRANSACTION,
  buildRepository,
} = require("../../test/helpers/method-payments-service-fixtures");

/**
 * Builds a loaded method double.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The method double.
 */
function method(overrides = {}) {
  return {
    id: 1,
    method_payment_type_id: 1,
    label: "PayPal",
    details: { email: "pagos@farmamad.com" },
    is_active: true,
    ...overrides,
  };
}

describe("method payment service update", () => {
  it("updates inside a transaction and reloads the method", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });
    const target = method();

    await expect(
      service.updateMethodPayment(target, {
        label: "PayPal principal",
        details: { email: "tesoreria@farmamad.com" },
      }),
    ).resolves.toMatchObject({ id: 1 });

    expect(repository.update).toHaveBeenCalledWith(
      target,
      {
        label: "PayPal principal",
        details: { email: "tesoreria@farmamad.com" },
      },
      { transaction: TRANSACTION },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      transaction: TRANSACTION,
    });
  });

  it("rejects changing method_payment_type_id with 422", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });

    await expect(
      service.updateMethodPayment(method(), { method_payment_type_id: 2 }),
    ).rejects.toMatchObject({
      status: 422,
      body: {
        errors: {
          method_payment_type_id: "method_payment_type_id cannot be changed",
        },
      },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("allows sending the same method_payment_type_id", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });
    const target = method();

    await expect(
      service.updateMethodPayment(target, {
        method_payment_type_id: 1,
        label: "PayPal principal",
      }),
    ).resolves.toMatchObject({ id: 1 });
    expect(repository.update).toHaveBeenCalledWith(
      target,
      { label: "PayPal principal" },
      { transaction: TRANSACTION },
    );
  });

  it("does not revalidate the stored details for a label-only update", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });

    await expect(
      service.updateMethodPayment(method({ details: { legacy: "value" } }), {
        label: "PayPal principal",
      }),
    ).resolves.toMatchObject({ id: 1 });
    expect(repository.findType).toHaveBeenCalled();
  });

  it("rejects reactivating when the type or its currency is inactive", async () => {
    const repository = buildRepository();
    repository.findType.mockResolvedValue({
      id: 1,
      fields: PAYPAL_FIELDS,
      is_active: false,
      currency: CURRENCY,
    });
    const service = createMethodPaymentService({ repository });

    await expect(
      service.updateMethodPayment(method({ is_active: false }), {
        is_active: true,
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { method_payment_type_id: "Invalid payment type" } },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows deactivating even when the type is inactive", async () => {
    const repository = buildRepository();
    repository.findType.mockResolvedValue({
      id: 1,
      fields: PAYPAL_FIELDS,
      is_active: false,
      currency: { ...CURRENCY, is_active: false },
    });
    const service = createMethodPaymentService({ repository });
    const target = method();

    await expect(
      service.updateMethodPayment(target, { is_active: false }),
    ).resolves.toMatchObject({ id: 1 });
    expect(repository.update).toHaveBeenCalledWith(
      target,
      { is_active: false },
      { transaction: TRANSACTION },
    );
  });

  it("deletes a loaded method", async () => {
    const repository = buildRepository();
    const service = createMethodPaymentService({ repository });
    const target = { id: 1 };

    await expect(service.deleteMethodPayment(target)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(target);
  });
});
