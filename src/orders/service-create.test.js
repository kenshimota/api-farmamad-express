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

  return {
    service,
    repository,
    calls,
    priceResolver,
    resolveTransactionCurrency,
  };
}

describe("order service creation", () => {
  it("creates the order with server-side number, totals and history", async () => {
    const lot = lotDouble({ id: 1, stock: 10, reserved: 0 });
    const { service, repository, calls } = setup({
      lots: { "15:1": [lot] },
    });

    const result = await service.createOrder(BODY, ACTOR);

    expect(result.id).toBe(10);
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.nextNumber).toHaveBeenCalledTimes(1);
    expect(calls.created).toEqual({
      number: 1,
      customer_id: 8,
      user_id: 12,
      currency_id: 3,
      status: "pending",
      subtotal: "28.58",
      total: "28.58",
      delivery_address: "Av. Monseñor Rivero 123",
      notes: "Entregar por la tarde",
    });
    expect(calls.items).toEqual([
      {
        order_id: 10,
        product_id: 15,
        item_state_id: 1,
        quantity: 2,
        unit_price: "14.29",
        subtotal: "28.58",
      },
    ]);
    expect(calls.allocations).toEqual([
      { order_item_id: 20, lot_id: 1, quantity: 2, status: "reserved" },
    ]);
    expect(calls.reserved).toEqual([{ lotId: 1, quantity: 2 }]);
    expect(calls.history).toEqual([
      {
        order_id: 10,
        event_type: "created",
        from_status: null,
        to_status: "pending",
        actor_user_id: 12,
        metadata: null,
      },
    ]);
    expect(repository.findById).toHaveBeenCalledWith(10, {
      transaction: expect.anything(),
    });
  });

  it("uses the customer price list and the default transaction currency", async () => {
    const { service, priceResolver, resolveTransactionCurrency } = setup({
      lots: { "15:1": [lotDouble({ id: 1, stock: 10 })] },
    });

    await service.createOrder(BODY, ACTOR);

    expect(resolveTransactionCurrency).toHaveBeenCalledTimes(1);
    expect(priceResolver).toHaveBeenCalledWith({
      product_id: 15,
      item_state_id: 1,
      price_list_id: 1,
      transactionCurrency: TRANSACTION_CURRENCY,
    });
  });

  it("keeps an explicit delivery address and trims the notes", async () => {
    const { service, calls } = setup({
      lots: { "15:1": [lotDouble({ id: 1, stock: 10 })] },
    });

    await service.createOrder(
      {
        items: BODY.items,
        delivery_address: "Calle 1",
        notes: "  Entregar por la tarde  ",
      },
      ACTOR,
    );

    expect(calls.created.delivery_address).toBe("Calle 1");
    expect(calls.created.notes).toBe("Entregar por la tarde");
  });

  it("supports two lines of the same product with different states", async () => {
    const prices = { 1: 14.29, 2: 20 };
    const priceResolver = createPriceResolverDouble(
      async ({ product_id, item_state_id, price_list_id }) => ({
        product_id,
        item_state_id,
        price_list_id,
        price: prices[item_state_id],
        currency: TRANSACTION_CURRENCY,
      }),
    );
    const { service, calls } = setup({
      priceResolver,
      lots: {
        "15:1": [lotDouble({ id: 1, stock: 10 })],
        "15:2": [lotDouble({ id: 2, stock: 10 })],
      },
    });

    await service.createOrder(
      {
        items: [
          { product_id: 15, item_state_id: 1, quantity: 1 },
          { product_id: 15, item_state_id: 2, quantity: 1 },
        ],
      },
      ACTOR,
    );

    expect(calls.items).toEqual([
      expect.objectContaining({
        item_state_id: 1,
        unit_price: "14.29",
        subtotal: "14.29",
      }),
      expect.objectContaining({
        item_state_id: 2,
        unit_price: "20.00",
        subtotal: "20.00",
      }),
    ]);
    expect(calls.created.subtotal).toBe("34.29");
  });

  it("ignores fields the client is not allowed to set", async () => {
    const { service, calls } = setup({
      lots: { "15:1": [lotDouble({ id: 1, stock: 10 })] },
    });

    await service.createOrder(
      {
        ...BODY,
        customer_id: 999,
        user_id: 999,
        status: "delivered",
        number: 999,
        subtotal: 0,
        total: 0,
        currency_id: 999,
      },
      ACTOR,
    );

    expect(calls.created).toMatchObject({
      customer_id: 8,
      user_id: 12,
      status: "pending",
      number: 1,
      currency_id: 3,
    });
  });

  it("falls back to the customer direction when the address is omitted", async () => {
    const { service, calls } = setup({
      customer: customerDouble({ direction: "Dirección del cliente" }),
      lots: { "15:1": [lotDouble({ id: 1, stock: 10 })] },
    });

    await service.createOrder({ items: BODY.items }, ACTOR);

    expect(calls.created.delivery_address).toBe("Dirección del cliente");
  });

  it("reserves from several lots in the received FEFO order", async () => {
    const first = lotDouble({ id: 1, stock: 1, reserved: 0 });
    const second = lotDouble({ id: 2, stock: 5, reserved: 0 });
    const { service, calls } = setup({
      lots: { "15:1": [first, second] },
    });

    await service.createOrder(
      { items: [{ product_id: 15, item_state_id: 1, quantity: 3 }] },
      ACTOR,
    );

    expect(calls.reserved).toEqual([
      { lotId: 1, quantity: 1 },
      { lotId: 2, quantity: 2 },
    ]);
    expect(calls.allocations).toEqual([
      { order_item_id: 20, lot_id: 1, quantity: 1, status: "reserved" },
      { order_item_id: 20, lot_id: 2, quantity: 2, status: "reserved" },
    ]);
    expect(first.reserved).toBe(1);
    expect(second.reserved).toBe(2);
  });

  it("rejects a customer user without a linked profile", async () => {
    const { service } = setup({ user: userDouble({ customer_id: null }) });

    await expect(service.createOrder(BODY, ACTOR)).rejects.toMatchObject({
      status: 403,
      body: { message: "Customer profile is not linked" },
    });
  });

  it("rejects a customer without a price list before touching stock", async () => {
    const { service, repository } = setup({
      customer: customerDouble({ price_list_id: null }),
    });

    await expect(service.createOrder(BODY, ACTOR)).rejects.toMatchObject({
      status: 403,
      body: { message: "Customer price list is not assigned" },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("rejects a role other than customer", async () => {
    const { service } = setup();

    await expect(
      service.createOrder(BODY, { sub: 1, role: "admin" }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: "Forbidden" },
    });
  });

  it("rejects duplicated product and item state pairs", async () => {
    const { service, repository } = setup();

    await expect(
      service.createOrder(
        {
          items: [
            { product_id: 15, item_state_id: 1, quantity: 1 },
            { product_id: 15, item_state_id: 1, quantity: 2 },
          ],
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { items: "Duplicate product 15 and item state 1" } },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});
