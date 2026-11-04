const {
  calculateLineSubtotal,
  calculateOrderTotals,
  toLineAmounts,
  toOrderAmounts,
} = require("./money");

describe("orders money", () => {
  it("calculates a line subtotal with two decimals", () => {
    expect(calculateLineSubtotal(2, 12.5)).toBe(25);
    expect(calculateLineSubtotal(3, "14.29")).toBe(42.87);
  });

  it("adds the lines in cents and keeps tax and total consistent", () => {
    const totals = calculateOrderTotals([
      { quantity: 2, unit_price: 14.29, tax_rate: 0 },
      { quantity: 1, unit_price: 0.1, tax_rate: 0 },
    ]);

    expect(totals).toEqual({
      subtotal: 28.68,
      tax_amount: 0,
      total: 28.68,
    });
  });

  it("adds the line tax to the order total", () => {
    const totals = calculateOrderTotals([
      { quantity: 2, unit_price: 10, tax_rate: 16 },
      { quantity: 1, unit_price: 5, tax_rate: 0 },
    ]);

    expect(totals).toEqual({
      subtotal: 25,
      tax_amount: 3.2,
      total: 28.2,
    });
  });

  it("formats line and order amounts for DECIMAL(12,2) columns", () => {
    expect(
      toLineAmounts({
        quantity: 2,
        unit_price: 14.29,
        tax_id: 2,
        tax_code: "IVA",
        tax_name: "Impuesto al Valor Agregado",
        tax_rate: 16,
      }),
    ).toEqual({
      unit_price: "14.29",
      subtotal: "28.58",
      tax_id: 2,
      tax_code: "IVA",
      tax_name: "Impuesto al Valor Agregado",
      tax_rate: "16.00",
      tax_amount: "4.57",
      total: "33.15",
    });
    expect(
      toOrderAmounts({ subtotal: 28.68, tax_amount: 4.59, total: 33.27 }),
    ).toEqual({
      subtotal: "28.68",
      tax_amount: "4.59",
      total: "33.27",
    });
  });
});
