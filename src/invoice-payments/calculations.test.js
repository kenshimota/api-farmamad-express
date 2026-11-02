describe("invoice payment helpers", () => {
  const {
    calculateAppliedAmount,
    calculateExchangeRate,
    calculatePaymentStatus,
    round2,
  } = require("./service");

  it("calculates the exchange rate with six decimals", () => {
    expect(calculateExchangeRate("2.000000", "1.000000")).toBe(2);
    expect(calculateExchangeRate("889.89", "1000.29")).toBe(0.889632);
  });

  it("calculates the applied amount and rounds it to two decimals", () => {
    expect(calculateAppliedAmount(10, 2)).toBe(20);
    expect(calculateAppliedAmount(10, 0.889632)).toBe(8.9);
    expect(round2(1.005)).toBe(1);
  });

  it.each([
    [0, 25, "pending"],
    [10, 25, "partial"],
    [25, 25, "paid"],
    [25.001, 25, "paid"],
  ])("maps paid %p of %p to %p", (paid, total, status) => {
    expect(calculatePaymentStatus(paid, total)).toBe(status);
  });
});
