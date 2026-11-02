const { createOrderDraftService } = require("./draft");
const { createOrderHistoryService } = require("./history-service");

/**
 * Builds the draft service with doubles recording persistence calls.
 * @param {object} [options] - Overrides.
 * @returns {object} The service and its doubles.
 */
function setup(options = {}) {
  const calls = { created: null, items: [], history: [] };
  const order = {
    id: 10,
    status: "draft",
    items: [],
    customer: { id: 8, direction: "Calle 1", price_list_id: 1 },
  };
  const repository = {
    transaction: jest.fn(async (callback) => callback({ id: "tx" })),
    nextNumber: jest.fn().mockResolvedValue(1),
    createOrder: jest.fn(async (values) => {
      calls.created = values;
      return { id: 10, ...values };
    }),
    createItems: jest.fn(async (rows) => {
      calls.items = rows;
      return rows.map((row, index) => ({ id: 20 + index, ...row }));
    }),
    createHistory: jest.fn(async (values) => {
      calls.history.push(values);
      return values;
    }),
    findById: jest.fn().mockResolvedValue(order),
  };
  const access = {
    resolveContext: jest.fn().mockResolvedValue(
      options.context ?? {
        role: "customer",
        userId: 12,
        customerId: 8,
      },
    ),
    resolveCreateCustomer: jest.fn().mockResolvedValue(
      options.target ?? {
        customer: { id: 8, direction: "Calle 1", payment_term_id: null },
        customerId: 8,
        priceListId: 1,
      },
    ),
  };
  const pricing = {
    priceLines: jest.fn(async (lines) =>
      lines.map((line) => ({ ...line, unit_price: 14.29 })),
    ),
  };
  const history = createOrderHistoryService({ repository });
  const service = createOrderDraftService({
    repository,
    access,
    pricing,
    history,
    resolveTransactionCurrency: jest
      .fn()
      .mockResolvedValue({ id: 3, code: "USD_BCV" }),
    assertTerm: jest.fn(),
  });

  return { service, repository, access, pricing, calls };
}

describe("order draft service", () => {
  it("creates a draft with zero totals and no stock reservation", async () => {
    const { service, calls } = setup();

    const order = await service.createDraft(
      { notes: "Entregar por la tarde" },
      { sub: 12, role: "customer" },
    );

    expect(order).toMatchObject({ id: 10, status: "draft" });
    expect(calls.created).toEqual({
      number: 1,
      customer_id: 8,
      user_id: 12,
      currency_id: 3,
      status: "draft",
      payment_term_id: null,
      subtotal: "0.00",
      total: "0.00",
      delivery_address: "Calle 1",
      notes: "Entregar por la tarde",
    });
    expect(calls.items).toEqual([]);
    expect(calls.history).toEqual([
      {
        order_id: 10,
        event_type: "created",
        from_status: null,
        to_status: "draft",
        actor_user_id: 12,
        metadata: null,
      },
    ]);
  });

  it("prices the optional lines and totals them without reserving lots", async () => {
    const { service, calls, repository } = setup();

    await service.createDraft(
      {
        items: [{ product_id: 15, item_state_id: 1, quantity: 2 }],
      },
      { sub: 12, role: "customer" },
    );

    expect(calls.created).toMatchObject({
      status: "draft",
      subtotal: "28.58",
      total: "28.58",
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
    expect(repository.findLotsForUpdate).toBeUndefined();
  });

  it("rejects duplicated product and item state pairs with 409", async () => {
    const { service } = setup();

    await expect(
      service.createDraft(
        {
          items: [
            { product_id: 15, item_state_id: 1, quantity: 1 },
            { product_id: 15, item_state_id: 1, quantity: 2 },
          ],
        },
        { sub: 12, role: "customer" },
      ),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Product and item state already in order" },
    });
  });
});
