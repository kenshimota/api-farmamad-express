const { createOrderPaymentTermService } = require("./payment-term-service");

/**
 * Builds the payment term service with doubles.
 * @param {object} [options] - Overrides.
 * @returns {object} The service and its doubles.
 */
function setup(options = {}) {
  const order = {
    id: 10,
    status: options.status ?? "draft",
    customer_id: 8,
    update: jest.fn().mockResolvedValue({ id: 10 }),
  };
  const repository = {
    transaction: jest.fn(async (callback) =>
      callback({ id: "tx", LOCK: { UPDATE: "UPDATE" } }),
    ),
    findById: jest.fn().mockResolvedValue(options.order ?? order),
    updatePaymentTerm: jest.fn(async (target, id) =>
      target.update({ payment_term_id: id }),
    ),
  };
  const access = {
    resolveContext: jest.fn().mockResolvedValue({
      role: options.role ?? "admin",
      userId: 1,
      customerId: null,
    }),
    assertEditAccess: jest.fn().mockResolvedValue(),
  };
  const assertTerm = jest
    .fn()
    .mockResolvedValue(options.term ?? { id: 3, days: 15, is_active: true });
  const service = createOrderPaymentTermService({
    repository,
    access,
    assertTerm,
  });

  return { service, repository, access, assertTerm, order };
}

describe("order payment term service", () => {
  it("replaces the term of a draft or requested order", async () => {
    const { service, repository, order } = setup({ status: "request" });

    await service.updatePaymentTerm(
      10,
      { payment_term_id: 3 },
      { sub: 1, role: "admin" },
    );

    expect(repository.updatePaymentTerm).toHaveBeenCalledWith(order, 3, {
      transaction: { id: "tx", LOCK: { UPDATE: "UPDATE" } },
    });
  });

  it("answers 403 for a customer and 422 after generate", async () => {
    const customer = setup({ role: "customer" });

    await expect(
      customer.service.updatePaymentTerm(
        10,
        { payment_term_id: 3 },
        { sub: 12, role: "customer" },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const generated = setup({ status: "generate" });

    await expect(
      generated.service.updatePaymentTerm(
        10,
        { payment_term_id: 3 },
        { sub: 1, role: "admin" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { status: "Order is not editable" } },
    });
  });

  it("answers 404 for an unknown order", async () => {
    const { service, repository } = setup();
    repository.findById.mockResolvedValue(null);

    await expect(
      service.updatePaymentTerm(
        999,
        { payment_term_id: 3 },
        { sub: 1, role: "admin" },
      ),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Order not found" },
    });
  });
});
