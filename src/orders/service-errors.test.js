const { createOrderService } = require("./service");
const { createHttpError } = require("../shared/http-error");
const {
  TRANSACTION_CURRENCY,
  createOrderRepositoryDouble,
  createPriceResolverDouble,
  lotDouble,
} = require("../../test/helpers/order-service-doubles");

const ACTOR = Object.freeze({ sub: 12, role: "customer" });
const ONE_LINE = Object.freeze({
  items: [{ product_id: 15, item_state_id: 1, quantity: 2 }],
});

/**
 * Builds the service with injectable doubles.
 * @param {object} [options] - Dependency overrides.
 * @returns {object} The service and its doubles.
 */
function setup(options = {}) {
  const { repository, calls } = createOrderRepositoryDouble(options);
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

  return { service, repository, calls, priceResolver };
}

describe("order service pricing and stock errors", () => {
  it("maps an invalid item state to the item error", async () => {
    const priceResolver = createPriceResolverDouble(async () => {
      throw createHttpError(422, {
        errors: { item_state_id: "Invalid item state" },
      });
    });
    const { service } = setup({ priceResolver });

    await expect(service.createOrder(ONE_LINE, ACTOR)).rejects.toMatchObject({
      status: 422,
      body: { errors: { items: "Invalid item state 1" } },
    });
  });

  it("maps a product without cost or price to not available", async () => {
    const priceResolver = createPriceResolverDouble(async () => {
      throw createHttpError(422, { errors: { product_id: "No price" } });
    });
    const { service } = setup({ priceResolver });

    await expect(service.createOrder(ONE_LINE, ACTOR)).rejects.toMatchObject({
      status: 422,
      body: { errors: { items: "Product 15 is not available for sale" } },
    });
  });

  it("propagates 403 and 503 errors from the pricing resolver", async () => {
    const forbidden = createPriceResolverDouble(async () => {
      throw createHttpError(403, {
        message: "Customer price list is not assigned",
      });
    });
    const first = setup({ priceResolver: forbidden });
    await expect(
      first.service.createOrder(ONE_LINE, ACTOR),
    ).rejects.toMatchObject({ status: 403 });

    const unavailable = createPriceResolverDouble(async () => {
      throw createHttpError(503, {
        message: "Default transaction currency is not configured",
      });
    });
    const second = setup({ priceResolver: unavailable });
    await expect(
      second.service.createOrder(ONE_LINE, ACTOR),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("answers 409 with the missing product/state pairs and writes nothing", async () => {
    const first = lotDouble({ id: 1, stock: 1, reserved: 0 });
    const { service, repository, calls } = setup({
      lots: {
        "15:1": [first],
        "20:2": [lotDouble({ id: 2, stock: 0, reserved: 0 })],
      },
    });

    await expect(
      service.createOrder(
        {
          items: [
            { product_id: 15, item_state_id: 1, quantity: 2 },
            { product_id: 20, item_state_id: 2, quantity: 1 },
          ],
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      status: 409,
      body: {
        message: "Insufficient stock",
        items: [
          { product_id: 15, item_state_id: 1 },
          { product_id: 20, item_state_id: 2 },
        ],
      },
    });
    expect(repository.createOrder).not.toHaveBeenCalled();
    expect(repository.createItems).not.toHaveBeenCalled();
    expect(repository.createAllocations).not.toHaveBeenCalled();
    expect(calls.reserved).toEqual([]);
  });

  it("does not reserve any lot when a later line lacks stock", async () => {
    const available = lotDouble({ id: 1, stock: 10 });
    const { service, calls } = setup({
      lots: { "15:1": [available], "20:2": [] },
    });

    await expect(
      service.createOrder(
        {
          items: [
            { product_id: 15, item_state_id: 1, quantity: 2 },
            { product_id: 20, item_state_id: 2, quantity: 1 },
          ],
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(calls.reserved).toEqual([]);
    expect(available.reserved).toBe(0);
  });

  it("propagates a 503 when the default transaction currency is missing", async () => {
    const { repository } = createOrderRepositoryDouble();
    const resolveTransactionCurrency = jest.fn(async () => {
      throw createHttpError(503, {
        message: "Default transaction currency is not configured",
      });
    });
    const service = createOrderService({
      repository,
      priceResolver: createPriceResolverDouble(),
      resolveTransactionCurrency,
    });

    await expect(service.createOrder(ONE_LINE, ACTOR)).rejects.toMatchObject({
      status: 503,
      body: { message: "Default transaction currency is not configured" },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});
