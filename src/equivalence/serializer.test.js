const {
  itemStateName,
  toDateOnly,
  toInvoiceLine,
  toIso,
  toMoney,
  toOrderLine,
  toPublicCurrency,
  toPublicPaymentTerm,
  toRate,
} = require("./serializer");

describe("equivalence serializer", () => {
  it("serializes dates and nullable values", () => {
    const date = new Date("2026-11-02T15:00:00.000Z");

    expect(toIso(date)).toBe("2026-11-02T15:00:00.000Z");
    expect(toIso("2026-11-02T15:00:00.000Z")).toBe("2026-11-02T15:00:00.000Z");
    expect(toIso(null)).toBeNull();
    expect(toDateOnly(date)).toBe("2026-11-02");
    expect(toDateOnly("2026-11-02T15:00:00.000Z")).toBe("2026-11-02");
    expect(toDateOnly(null)).toBeNull();
  });

  it("converts money and rate decimals", () => {
    expect(toMoney("12.345")).toBe(12.35);
    expect(toMoney(null)).toBeNull();
    expect(toRate("0.0011235")).toBe(0.001123);
  });

  it("builds the public currency and payment term", () => {
    expect(
      toPublicCurrency({
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
        rate: "889.89",
        is_base: false,
      }),
    ).toEqual({
      id: 3,
      code: "USD_BCV",
      name: "Dólar BCV",
      symbol: "$",
      rate: 889.89,
      is_base: false,
    });
    expect(toPublicPaymentTerm(null)).toBeNull();
    expect(
      toPublicPaymentTerm({ id: 1, code: "cash", name: "Contado", days: 0 }),
    ).toEqual({ id: 1, code: "cash", name: "Contado", days: 0 });
  });

  it("falls back from the item state label to its name", () => {
    expect(itemStateName(null)).toBeNull();
    expect(itemStateName({ name: "sellable", label: "" })).toBe("sellable");
    expect(itemStateName({ name: "sellable", label: "Vendible" })).toBe(
      "Vendible",
    );
  });

  it("converts order lines with the catalog product and state", () => {
    const line = toOrderLine(
      {
        id: 20,
        product_id: 15,
        item_state_id: 2,
        quantity: "2",
        unit_price: "10.00",
        subtotal: "20.00",
        product: { id: 15, name: "Producto", reference: "REF-15" },
        item_state: { id: 2, name: "sellable", label: "Vendible" },
      },
      889.89,
    );

    expect(line).toMatchObject({
      order_item_id: 20,
      product_name: "Producto",
      product_reference: "REF-15",
      item_state_name: "Vendible",
      quantity: 2,
      unit_price_target: 8898.9,
      subtotal_target: 17797.8,
    });
  });

  it("keeps null product and state fields when they are not loaded", () => {
    const line = toOrderLine(
      {
        id: 21,
        product_id: 16,
        item_state_id: 3,
        quantity: "1",
        unit_price: "1.00",
        subtotal: "1.00",
      },
      1,
    );

    expect(line.product_name).toBeNull();
    expect(line.product_reference).toBeNull();
    expect(line.item_state_name).toBeNull();
  });

  it("converts invoice line snapshots without the catalog", () => {
    const line = toInvoiceLine(
      {
        order_item_id: 20,
        product_id: 15,
        product_name: "Producto demo",
        product_reference: "REF-015",
        item_state_id: 1,
        item_state_name: "Vendible",
        quantity: 2,
        unit_price: "10.00",
        subtotal: "20.00",
      },
      889.89,
    );

    expect(line).toMatchObject({
      order_item_id: 20,
      product_name: "Producto demo",
      item_state_name: "Vendible",
      unit_price_target: 8898.9,
      subtotal_target: 17797.8,
    });
  });
});
