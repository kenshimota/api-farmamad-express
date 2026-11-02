jest.mock("../payment-terms/assignment", () => ({
  assertAssignablePaymentTerm: jest.fn(),
}));

const { assertAssignablePaymentTerm } = require("../payment-terms/assignment");
const { createOrderService } = require("./service");
const {
  TRANSACTION_CURRENCY,
  createOrderRepositoryDouble,
  createPriceResolverDouble,
  customerDouble,
  lotDouble,
  userDouble,
} = require("../../test/helpers/order-service-doubles");

const ACTOR = Object.freeze({ sub: 12, role: "customer" });
const BODY = Object.freeze({
  items: [{ product_id: 15, item_state_id: 1, quantity: 2 }],
  notes: "Entregar por la tarde",
});

/**
 * Builds the service with injectable doubles.
 * @param {object} [options] - Dependency overrides.
 * @returns {object} The service and its doubles.
 */
function setup(options = {}) {
  const repositoryState = createOrderRepositoryDouble(options);
  const { repository, calls } = repositoryState;
  const priceResolver =
    options.priceResolver ??
    createPriceResolverDouble(options.priceImplementation);
  const resolveTransactionCurrency = jest
    .fn()
    .mockResolvedValue(TRANSACTION_CURRENCY);
  const service = createOrderService({
    repository,
    priceResolver,
    resolveTransactionCurrency,
  });

  return { service, repository, calls };
}

describe("order service payment term snapshot", () => {
  it("copies the customer payment term and ignores a customer override", async () => {
    const term = { id: 2, code: "credit_10", days: 10, is_active: true };
    assertAssignablePaymentTerm.mockResolvedValue(term);
    const { service, calls } = setup({
      customer: customerDouble({ payment_term_id: 2 }),
      lots: { "15:1": [lotDouble({ id: 1, stock: 10 })] },
    });

    await service.createOrder({ ...BODY, payment_term_id: 3 }, ACTOR);

    expect(assertAssignablePaymentTerm).toHaveBeenCalledWith(2);
    expect(calls.created.payment_term_id).toBe(2);
  });

  it("rejects an inactive payment term copied from the customer", async () => {
    assertAssignablePaymentTerm.mockRejectedValue({
      status: 422,
      body: { errors: { payment_term_id: "Invalid payment term" } },
    });
    const { service, repository } = setup({
      customer: customerDouble({ payment_term_id: 2 }),
    });

    await expect(service.createOrder(BODY, ACTOR)).rejects.toMatchObject({
      status: 422,
      body: { errors: { payment_term_id: "Invalid payment term" } },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});

describe("order service payment term update", () => {
  it("replaces the term of a draft order", async () => {
    const term = { id: 3, code: "credit_15", days: 15, is_active: true };
    assertAssignablePaymentTerm.mockResolvedValue(term);
    const { service, repository } = setup();
    const order = {
      id: 10,
      status: "draft",
      update: jest.fn().mockResolvedValue({ id: 10, status: "draft" }),
    };
    repository.findById
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ id: 10, status: "draft", payment_term_id: 3 });

    await expect(
      service.updatePaymentTerm(
        10,
        { payment_term_id: 3 },
        { sub: 1, role: "seller" },
      ),
    ).resolves.toMatchObject({ id: 10, payment_term_id: 3 });
    expect(repository.updatePaymentTerm).toHaveBeenCalledWith(order, 3);
  });

  it("answers 403 for a customer and 404 for an unknown order", async () => {
    const { service } = setup();

    await expect(
      service.updatePaymentTerm(
        10,
        { payment_term_id: 3 },
        { sub: 1, role: "customer" },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const { service: missingService, repository } = setup();
    repository.findById.mockResolvedValue(null);
    await expect(
      missingService.updatePaymentTerm(
        999,
        { payment_term_id: 3 },
        { sub: 1, role: "admin" },
      ),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Order not found" },
    });
  });

  it("rejects a non-editable order and an inactive term", async () => {
    const { service, repository } = setup();
    repository.findById.mockResolvedValue({ id: 10, status: "pending" });

    await expect(
      service.updatePaymentTerm(
        10,
        { payment_term_id: 3 },
        { sub: 1, role: "admin" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { status: "Order is not editable" } },
    });

    repository.findById.mockResolvedValue({ id: 10, status: "request" });
    assertAssignablePaymentTerm.mockRejectedValue({
      status: 422,
      body: { errors: { payment_term_id: "Invalid payment term" } },
    });
    await expect(
      service.updatePaymentTerm(
        10,
        { payment_term_id: 99 },
        { sub: 1, role: "admin" },
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { payment_term_id: "Invalid payment term" } },
    });
  });
});
