const {
  calculateLineAmounts,
  calculateTaxAmount,
  sumLineAmounts,
  toTaxSnapshot,
} = require("./tax");

describe("calculateTaxAmount", () => {
  it("applies a percentage rate rounded to two decimals", () => {
    expect(calculateTaxAmount(20, 16)).toBe(3.2);
    expect(calculateTaxAmount("14.29", "16.00")).toBe(2.29);
    expect(calculateTaxAmount(10, 0)).toBe(0);
  });

  it("returns zero for missing, negative or non-numeric rates", () => {
    expect(calculateTaxAmount(20, undefined)).toBe(0);
    expect(calculateTaxAmount(20, -5)).toBe(0);
    expect(calculateTaxAmount(20, "abc")).toBe(0);
  });
});

describe("calculateLineAmounts", () => {
  it("calculates the pre-tax subtotal, the tax and the line total", () => {
    expect(calculateLineAmounts({ quantity: 2, unit_price: 10 })).toEqual({
      subtotal: 20,
      tax_amount: 0,
      total: 20,
    });
    expect(
      calculateLineAmounts({ quantity: 2, unit_price: 10, tax_rate: 16 }),
    ).toEqual({ subtotal: 20, tax_amount: 3.2, total: 23.2 });
  });
});

describe("sumLineAmounts", () => {
  it("sums the lines and the empty list returns zeros", () => {
    expect(sumLineAmounts([])).toEqual({
      subtotal: 0,
      tax_amount: 0,
      total: 0,
    });
    expect(
      sumLineAmounts([
        { subtotal: 20, tax_amount: 3.2 },
        { subtotal: 5.5, tax_amount: 0.88 },
      ]),
    ).toEqual({ subtotal: 25.5, tax_amount: 4.08, total: 29.58 });
  });
});

describe("toTaxSnapshot", () => {
  it("returns a zero snapshot when the product has no tax", () => {
    expect(toTaxSnapshot(null)).toEqual({
      tax_id: null,
      tax_code: null,
      tax_name: null,
      tax_rate: 0,
    });
    expect(toTaxSnapshot(undefined)).toEqual({
      tax_id: null,
      tax_code: null,
      tax_name: null,
      tax_rate: 0,
    });
  });

  it("copies the tax fields from a plain object", () => {
    expect(
      toTaxSnapshot({ id: 2, code: "IVA", name: "Impuesto", rate: "16.00" }),
    ).toEqual({
      tax_id: 2,
      tax_code: "IVA",
      tax_name: "Impuesto",
      tax_rate: 16,
    });
  });
});
