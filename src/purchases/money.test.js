const {
  calculateLineSubtotal,
  calculateLineTotal,
  calculateTotals,
  hasAtMostTwoDecimals,
  toCents,
  toDecimal,
  toLineAmounts,
  toTotalsAmounts,
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

describe("calculateLineTotal", () => {
  it("adds the tax to the subtotal in cents", () => {
    expect(calculateLineTotal(800, 128)).toBe(928);
    expect(calculateLineTotal(0.1, 0.2)).toBe(0.3);
  });
});

describe("toLineAmounts", () => {
  it("formats the unit cost, subtotal and tax for the columns", () => {
    expect(
      toLineAmounts({ quantity: 3, unit_cost: 12.5, tax_amount: 6 }),
    ).toEqual({
      unit_cost: "12.50",
      subtotal: "37.50",
      tax_amount: "6.00",
    });
  });

  it("defaults a missing tax to zero", () => {
    expect(toLineAmounts({ quantity: 2, unit_cost: "10.00" })).toEqual({
      unit_cost: "10.00",
      subtotal: "20.00",
      tax_amount: "0.00",
    });
  });
});

describe("toTotalsAmounts", () => {
  it("formats the header totals for the columns", () => {
    expect(
      toTotalsAmounts({ subtotal: 837.5, tax_amount: 134, total: 971.5 }),
    ).toEqual({ subtotal: "837.50", tax_amount: "134.00", total: "971.50" });
  });
});

describe("calculateTotals", () => {
  it("sums the line subtotals and the line taxes", () => {
    expect(
      calculateTotals([
        { quantity: 40, unit_cost: 20, tax_amount: "128.00" },
        { quantity: 3, unit_cost: 12.5, tax_amount: 6 },
      ]),
    ).toEqual({ subtotal: 837.5, tax_amount: 134, total: 971.5 });
  });

  it("treats a missing line tax as zero", () => {
    expect(calculateTotals([{ quantity: 2, unit_cost: 10 }])).toEqual({
      subtotal: 20,
      tax_amount: 0,
      total: 20,
    });
  });

  it("keeps the total exact with integer arithmetic", () => {
    expect(
      calculateTotals([{ quantity: 1, unit_cost: 0.05, tax_amount: 0.01 }]),
    ).toEqual({ subtotal: 0.05, tax_amount: 0.01, total: 0.06 });
  });

  it("returns zero totals for an empty purchase", () => {
    expect(calculateTotals([])).toEqual({
      subtotal: 0,
      tax_amount: 0,
      total: 0,
    });
  });
});
