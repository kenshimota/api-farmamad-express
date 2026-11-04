const {
  BASE_CURRENCY,
  ISSUED_AT,
  SOURCE_CURRENCY,
  buildService,
  orderSnapshot,
} = require("../../test/helpers/document-quotation");

describe("quotation service", () => {
  it("emits the quotation in the order currency without conversion", async () => {
    const { service, currencyRepository } = buildService();

    const data = await service.getQuotation(10, { sub: 1, role: "admin" });

    expect(data).toMatchObject({
      order: { id: 10, number: 10, status: "generate" },
      issued_at: ISSUED_AT.toISOString(),
      is_conversion: false,
      exchange_rate: 1,
      subtotal_source: 120,
      total_source: 120,
      subtotal_target: 120,
      total_target: 120,
      rounding_adjustment: 0,
      source_currency: { id: 3, code: "USD_BCV", rate: 889.89 },
      target_currency: { id: 3, code: "USD_BCV", rate: 889.89 },
      payment_term: { name: "Contado", days: 0 },
    });
    expect(data.items[0]).toEqual({
      product_name: "Ibuprofeno",
      product_reference: "REF-1",
      item_state_name: "Vendible",
      quantity: 2,
      unit_price_source: 60,
      subtotal_source: 120,
      unit_price_target: 60,
      subtotal_target: 120,
    });
    expect(data.source_rate_changed_at).toBe("2026-11-01T10:00:00.000Z");
    expect(currencyRepository.findCurrencyById).not.toHaveBeenCalled();
  });

  it("converts to VES with round6 rate and round2 amounts", async () => {
    const { service, currencyRepository } = buildService();
    currencyRepository.findCurrencyById.mockResolvedValue(BASE_CURRENCY);

    const data = await service.getQuotation(
      10,
      { sub: 1, role: "admin" },
      { currencyId: 1 },
    );

    expect(data).toMatchObject({
      is_conversion: true,
      exchange_rate: 889.89,
      total_source: 120,
      total_target: 106786.8,
      subtotal_target: 106786.8,
      rounding_adjustment: 0,
      target_currency: { id: 1, code: "VES", rate: 1 },
    });
    expect(data.items[0]).toMatchObject({
      unit_price_target: 53393.4,
      subtotal_target: 106786.8,
    });
    expect(data.target_rate_changed_at).toBe("2026-10-30T08:00:00.000Z");
  });

  it("reports the rounding adjustment when line rounding changes the sum", async () => {
    const order = orderSnapshot({
      subtotal: "0.99",
      total: "0.99",
      currency: { ...SOURCE_CURRENCY, rate: "1.500000" },
      items: [
        {
          id: 1,
          quantity: 3,
          unit_price: "0.33",
          subtotal: "0.99",
          product: { name: "Producto", reference: "REF" },
          item_state: { name: "sellable", label: "Vendible" },
        },
      ],
    });
    const { service, currencyRepository } = buildService(order);
    currencyRepository.findCurrencyById.mockResolvedValue(BASE_CURRENCY);

    const data = await service.getQuotation(
      10,
      { sub: 1, role: "admin" },
      { currencyId: 1 },
    );

    expect(data.items[0]).toMatchObject({
      unit_price_target: 0.49,
      subtotal_target: 1.47,
    });
    expect(data.total_target).toBe(1.48);
    expect(data.rounding_adjustment).toBe(0.01);
  });

  it("keeps the same-currency quotation when the order currency is inactive", async () => {
    const order = orderSnapshot({
      currency: { ...SOURCE_CURRENCY, is_active: false },
    });
    const { service } = buildService(order);

    const data = await service.getQuotation(10, { sub: 1, role: "customer" });

    expect(data.exchange_rate).toBe(1);
    expect(data.is_conversion).toBe(false);
  });

  it("tolerates missing relations, history and line labels", async () => {
    const order = orderSnapshot({
      status: "draft",
      createdAt: null,
      customer: null,
      payment_term: null,
      delivery_address: null,
      notes: null,
      items: [
        {
          id: 1,
          quantity: 1,
          unit_price: "10.00",
          subtotal: "10.00",
          product: null,
          item_state: null,
        },
      ],
    });
    const { service, currencyRepository } = buildService(order);
    currencyRepository.findLatestRateChange.mockResolvedValue(null);

    const data = await service.getQuotation(10, { sub: 1, role: "admin" });

    expect(data).toMatchObject({
      customer: null,
      payment_term: null,
      delivery_address: null,
      notes: null,
      source_rate_changed_at: null,
      target_rate_changed_at: null,
      order: { created_at: null },
    });
    expect(data.items[0]).toMatchObject({
      product_name: null,
      product_reference: null,
      item_state_name: null,
    });
  });

  it("allows the explicit order currency even when it is inactive", async () => {
    const order = orderSnapshot({
      currency: { ...SOURCE_CURRENCY, is_active: false },
    });
    const { service, currencyRepository } = buildService(order);
    currencyRepository.findCurrencyById.mockResolvedValue(order.currency);

    const data = await service.getQuotation(
      10,
      { sub: 1, role: "customer" },
      { currencyId: 3 },
    );

    expect(data.exchange_rate).toBe(1);
    expect(data.is_conversion).toBe(false);
  });
});
