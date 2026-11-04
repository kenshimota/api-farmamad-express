const { isUsableCurrency } = require("./currency");

describe("isUsableCurrency", () => {
  it("accepts an active currency with a positive rate", () => {
    expect(isUsableCurrency({ rate: "1.50", is_active: true })).toBe(true);
    expect(isUsableCurrency({ rate: "1.50" })).toBe(true);
  });

  it("rejects a missing, inactive or invalid currency", () => {
    expect(isUsableCurrency(null)).toBe(false);
    expect(isUsableCurrency(undefined)).toBe(false);
    expect(isUsableCurrency({ rate: "1.50", is_active: false })).toBe(false);
    expect(isUsableCurrency({ rate: "0" })).toBe(false);
    expect(isUsableCurrency({ rate: "abc" })).toBe(false);
  });
});
