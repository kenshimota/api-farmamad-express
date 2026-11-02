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

  it("adds the lines in cents and keeps total equal to subtotal", () => {
    const totals = calculateOrderTotals([
      { quantity: 2, unit_price: 14.29 },
      { quantity: 1, unit_price: 0.1 },
    ]);

    expect(totals).toEqual({ subtotal: 28.68, total: 28.68 });
  });

  it("formats line and order amounts for DECIMAL(12,2) columns", () => {
    expect(toLineAmounts({ quantity: 2, unit_price: 14.29 })).toEqual({
      unit_price: "14.29",
      subtotal: "28.58",
    });
    expect(toOrderAmounts({ subtotal: 28.68, total: 28.68 })).toEqual({
      subtotal: "28.68",
      total: "28.68",
    });
  });
});
