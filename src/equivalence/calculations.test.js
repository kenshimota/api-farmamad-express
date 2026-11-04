const {
  calculateRate,
  convertAmount,
  round2,
  round6,
} = require("./calculations");

describe("equivalence calculations", () => {
  it("rounds the exchange rate to six decimals", () => {
    expect(round6(889.89)).toBe(889.89);
    expect(round6(1 / 889.89)).toBe(0.001124);
    expect(round6(123.123456789)).toBe(123.123457);
  });

  it("calculates the target units per source unit", () => {
    expect(calculateRate(889.89, 1)).toBe(889.89);
    expect(calculateRate(1, 889.89)).toBe(0.001124);
    expect(calculateRate(1000.29, 889.89)).toBe(1.12406);
  });

  it("returns zero when a rate cannot produce a positive exchange rate", () => {
    expect(calculateRate(0, 1)).toBe(0);
    expect(calculateRate(1, 0)).toBe(0);
    expect(calculateRate("x", 1)).toBe(0);
  });

  it("converts an amount and rounds it to two decimals", () => {
    expect(round2(1.005)).toBe(1);
    expect(convertAmount(120, 889.89)).toBe(106786.8);
    expect(convertAmount("70", 889.89)).toBe(62292.3);
    expect(convertAmount(8.5, 889.89)).toBe(7564.06);
  });
});
