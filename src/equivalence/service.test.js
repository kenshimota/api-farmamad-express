const {
  BASE_CURRENCY,
  SOURCE_CURRENCY,
  TARGET_CURRENCY,
  buildService,
  orderFixture,
} = require("../../test/helpers/equivalence");

describe("order equivalence", () => {
  it("converts the stored totals and lines into the base currency by default", async () => {
    const { service, orders } = buildService({ order: orderFixture() });

    const result = await service.getOrderEquivalence(10, { role: "admin" });

    expect(orders.getOrder).toHaveBeenCalledWith(10, { role: "admin" });
    expect(result).toMatchObject({
      resource: "order",
      order: {
        id: 10,
        number: 10,
        status: "generate",
        customer_id: 8,
        created_at: "2026-11-02T14:30:00.000Z",
      },
      payment_term: { id: 1, code: "cash", name: "Contado", days: 0 },
      source: {
        currency: {
          id: 3,
          code: "USD_BCV",
          name: "Dólar BCV",
          symbol: "$",
          rate: 889.89,
          is_base: false,
        },
        subtotal: 85,
        total: 85,
      },
      target: {
        currency: {
          id: 1,
          code: "VES",
          name: "Bolívar",
          symbol: "Bs",
          rate: 1,
          is_base: true,
        },
        subtotal: 75640.65,
        total: 75640.65,
      },
      exchange_rate: 889.89,
      rate_source: "currencies.rate",
      rates_updated_at: {
        source: "2026-11-02T12:00:00.000Z",
        target: null,
      },
      calculated_at: "2026-11-03T15:00:00.000Z",
      payment: {
        is_cash: true,
        amount_due_source: 85,
        amount_due_target: 75640.65,
      },
    });
    expect(result.lines).toEqual([
      {
        order_item_id: 20,
        product_id: 15,
        product_name: "Producto demo",
        product_reference: "REF-015",
        item_state_id: 1,
        item_state_name: "Vendible",
        quantity: 10,
        unit_price_source: 8.5,
        subtotal_source: 85,
        unit_price_target: 7564.06,
        subtotal_target: 75640.6,
      },
    ]);
    expect(result.rounding_adjustment).toBe(0.05);
  });

  it("uses the requested target currency and reports a credit term", async () => {
    const { service, repository } = buildService({
      order: orderFixture({
        payment_term: { id: 2, code: "credit_10", name: "Crédito", days: 10 },
      }),
    });

    const result = await service.getOrderEquivalence(10, { role: "admin" }, 2);

    expect(repository.findBaseCurrency).not.toHaveBeenCalled();
    expect(result.target.currency).toMatchObject({ id: 2, code: "USDT" });
    expect(result.exchange_rate).toBe(0.889632);
    expect(result.target.total).toBe(75.62);
    expect(result.payment.is_cash).toBe(false);
    expect(result.payment.amount_due_target).toBe(75.62);
  });

  it("returns rate 1 and unchanged amounts when the target is the source currency", async () => {
    const { service } = buildService({ order: orderFixture() });

    const result = await service.getOrderEquivalence(10, { role: "admin" }, 3);

    expect(result.exchange_rate).toBe(1);
    expect(result.target.total).toBe(85);
    expect(result.lines[0].subtotal_target).toBe(85);
    expect(result.rounding_adjustment).toBe(0);
    expect(result.rates_updated_at).toEqual({
      source: "2026-11-02T12:00:00.000Z",
      target: "2026-11-02T12:00:00.000Z",
    });
  });

  it("returns is_cash null when the order has no payment term", async () => {
    const { service } = buildService({
      order: orderFixture({ payment_term: null, payment_term_id: null }),
    });

    const result = await service.getOrderEquivalence(10, { role: "admin" });

    expect(result.payment_term).toBeNull();
    expect(result.payment.is_cash).toBeNull();
  });

  it("returns 404 for an unknown target currency", async () => {
    const { service } = buildService({ order: orderFixture() });

    await expect(
      service.getOrderEquivalence(10, { role: "admin" }, 999),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Currency not found" },
    });
  });

  it("returns 422 for an inactive target currency", async () => {
    const { service, repository } = buildService({ order: orderFixture() });

    repository.findCurrencyById.mockImplementation((id) =>
      Promise.resolve(
        id === 2
          ? { ...TARGET_CURRENCY, is_active: false }
          : id === 3
            ? SOURCE_CURRENCY
            : null,
      ),
    );

    await expect(
      service.getOrderEquivalence(10, { role: "admin" }, 2),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { currency_id: "Invalid currency" } },
    });
  });

  it("returns 503 when the base currency is missing", async () => {
    const { service, repository } = buildService({ order: orderFixture() });

    repository.findBaseCurrency.mockResolvedValue(null);

    await expect(
      service.getOrderEquivalence(10, { role: "admin" }),
    ).rejects.toMatchObject({
      status: 503,
      body: { message: "Currency configuration is incomplete" },
    });
  });

  it.each([
    ["source", SOURCE_CURRENCY, { ...BASE_CURRENCY, rate: "0" }],
    ["source rate", { ...SOURCE_CURRENCY, rate: "0" }, BASE_CURRENCY],
  ])(
    "returns 503 when the %s rate is invalid",
    async (_label, source, base) => {
      const { service, repository } = buildService({ order: orderFixture() });

      repository.findCurrencyById.mockImplementation((id) =>
        Promise.resolve(
          id === SOURCE_CURRENCY.id
            ? source
            : [TARGET_CURRENCY, BASE_CURRENCY].find((c) => c.id === id),
        ),
      );
      repository.findBaseCurrency.mockResolvedValue(base);

      await expect(
        service.getOrderEquivalence(10, { role: "admin" }),
      ).rejects.toMatchObject({
        status: 503,
        body: { message: "Currency configuration is incomplete" },
      });
    },
  );
});
