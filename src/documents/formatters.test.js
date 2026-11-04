const {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPaymentStatus,
  formatRate,
  sanitizeText,
  truncateNotes,
} = require("./formatters");

describe("document formatters", () => {
  it("formats money with the Spanish Venezuelan separators and symbol", () => {
    expect(formatMoney(1234.5, { symbol: "$" })).toBe("$ 1.234,50");
    expect(formatMoney("106786.8", { symbol: "Bs" })).toBe("Bs 106.786,80");
  });

  it("falls back to the currency code when there is no symbol", () => {
    expect(formatMoney(12, { code: "USD_BCV" })).toBe("USD_BCV 12,00");
    expect(formatMoney(12, null)).toBe("12,00");
    expect(formatMoney(null, null)).toBe("0,00");
  });

  it("formats rates with up to six decimals", () => {
    expect(formatRate(889.89)).toBe("889,89");
    expect(formatRate(1.234567)).toBe("1,234567");
    expect(formatRate(null)).toBe("0,00");
  });

  it("formats dates and date-times in Venezuelan Spanish", () => {
    const value = new Date("2026-11-02T14:30:00.000Z");

    expect(formatDate(value)).toBe("02/11/2026");
    expect(formatDateTime(value)).toBe("02/11/2026 10:30");
    expect(formatDate(null)).toBe("");
    expect(formatDateTime("invalid")).toBe("");
  });

  it("keeps Spanish characters and supported currency symbols", () => {
    expect(sanitizeText("áéíóú ñ ü € $ Bs")).toBe("áéíóú ñ ü € $ Bs");
    expect(sanitizeText("Factura “especial” 😀")).toBe("Factura ?especial? ?");
    expect(sanitizeText(null)).toBe("");
  });

  it("truncates notes to the model limit", () => {
    const long = "a".repeat(1200);

    expect(truncateNotes(long)).toHaveLength(1000);
    expect(truncateNotes(null)).toBe("");
    expect(truncateNotes("corto")).toBe("corto");
  });

  it("translates the invoice payment status", () => {
    expect(formatPaymentStatus("pending")).toBe("Pendiente");
    expect(formatPaymentStatus("partial")).toBe("Parcial");
    expect(formatPaymentStatus("paid")).toBe("Pagada");
    expect(formatPaymentStatus("other")).toBe("other");
    expect(formatPaymentStatus(null)).toBe("");
  });
});
