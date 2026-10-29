const {
  calculateLineSubtotal,
  calculateTotals,
  hasAtMostTwoDecimals,
  toCents,
  toDecimal,
} = require("./money");

describe("toCents", () => {
  it("converts numbers and numeric strings to integer cents", () => {
    expect(toCents(12.5)).toBe(1250);
    expect(toCents("20.00")).toBe(2000);
    expect(toCents(0)).toBe(0);
  });

  it("rejects non numeric values", () => {
    expect(() => toCents("abc")).toThrow("Invalid money value");
  });
});

describe("hasAtMostTwoDecimals", () => {
  it.each([
    [12.5, true],
    [12.34, true],
    [12.345, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
  ])("checks %p", (value, expected) => {
    expect(hasAtMostTwoDecimals(value)).toBe(expected);
  });
});

describe("toDecimal", () => {
  it("formats with exactly two decimals", () => {
    expect(toDecimal(837.5)).toBe("837.50");
    expect(toDecimal("12.345")).toBe("12.35");
    expect(toDecimal(0)).toBe("0.00");
  });
});

describe("calculateLineSubtotal", () => {
  it("multiplies the quantity by the unit cost", () => {
    expect(calculateLineSubtotal(40, 20)).toBe(800);
    expect(calculateLineSubtotal(3, 12.5)).toBe(37.5);
  });
});

describe("calculateTotals", () => {
  it("calculates the subtotal, rounded tax and total", () => {
    expect(
      calculateTotals(
        [
          { quantity: 40, unit_cost: 20 },
          { quantity: 3, unit_cost: 12.5 },
        ],
        16,
      ),
    ).toEqual({ subtotal: 837.5, tax_amount: 134, total: 971.5 });
  });

  it("rounds half cents with integer arithmetic", () => {
    expect(calculateTotals([{ quantity: 1, unit_cost: 0.05 }], 8.25)).toEqual({
      subtotal: 0.05,
      tax_amount: 0,
      total: 0.05,
    });
  });

  it("returns zero totals for an empty purchase", () => {
    expect(calculateTotals([], 16)).toEqual({
      subtotal: 0,
      tax_amount: 0,
      total: 0,
    });
  });
});
