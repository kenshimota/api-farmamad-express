const {
  BASE_CURRENCY,
  SOURCE_CURRENCY,
  buildService,
  expectHttpError,
  orderSnapshot,
} = require("../../test/helpers/document-quotation");

describe("quotation service errors", () => {
  it.each([
    ["invoiced", 409, { message: "Order is already invoiced" }],
    ["cancelled", 409, { message: "Order is cancelled" }],
  ])("rejects a %s order", async (status, code, body) => {
    const { service } = buildService(orderSnapshot({ status }));

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }),
      code,
      body,
    );
  });

  it("rejects a status outside the quotation chain", async () => {
    const { service } = buildService(orderSnapshot({ status: "picking" }));

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }),
      422,
      { errors: { status: "Order is not quotable" } },
    );
  });

  it("rejects an order without lines", async () => {
    const { service } = buildService(orderSnapshot({ items: [] }));

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }),
      422,
      { errors: { items: "Order has no items" } },
    );
  });

  it("rejects a missing target currency", async () => {
    const { service, currencyRepository } = buildService();
    currencyRepository.findCurrencyById.mockResolvedValue(null);

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }, { currencyId: 99 }),
      404,
      { message: "Currency not found" },
    );
  });

  it("rejects an inactive target currency", async () => {
    const { service, currencyRepository } = buildService();
    currencyRepository.findCurrencyById.mockResolvedValue({
      ...BASE_CURRENCY,
      is_active: false,
    });

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }, { currencyId: 1 }),
      422,
      { errors: { currency_id: "Invalid currency" } },
    );
  });

  it("requires the base currency to be configured", async () => {
    const { service, currencyRepository } = buildService();
    currencyRepository.findBaseCurrency.mockResolvedValue(null);

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }),
      503,
      { message: "Currency configuration is incomplete" },
    );
  });

  it("requires the source currency rate", async () => {
    const order = orderSnapshot({
      currency: { ...SOURCE_CURRENCY, rate: "0.000000" },
    });
    const { service } = buildService(order);

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }),
      503,
      { message: "Currency configuration is incomplete" },
    );
  });

  it("requires the target currency rate", async () => {
    const { service, currencyRepository } = buildService();
    currencyRepository.findCurrencyById.mockResolvedValue({
      ...BASE_CURRENCY,
      rate: "0.000000",
    });

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }, { currencyId: 1 }),
      503,
      { message: "Currency configuration is incomplete" },
    );
  });

  it("requires the order currency", async () => {
    const { service } = buildService(orderSnapshot({ currency: null }));

    await expectHttpError(
      service.getQuotation(10, { sub: 1, role: "admin" }),
      503,
      { message: "Currency configuration is incomplete" },
    );
  });
});
