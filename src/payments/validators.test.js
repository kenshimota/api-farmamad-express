const {
  addDays,
  createPaymentSchema,
  hasAtMostTwoDecimals,
  parseDateOnly,
  updatePaymentSchema,
} = require("./validators");

describe("payment validators", () => {
  it("accepts a complete create payload and normalizes metadata", async () => {
    const values = await createPaymentSchema.validate(
      {
        customer_id: 8,
        method_payment_id: 3,
        amount: 100.5,
        reference: "  TRX-123  ",
        notes: "   ",
        paid_at: "2026-11-01T12:00:00.000Z",
      },
      { stripUnknown: true },
    );

    expect(values).toEqual({
      customer_id: 8,
      method_payment_id: 3,
      amount: 100.5,
      reference: "TRX-123",
      notes: null,
      paid_at: new Date("2026-11-01T12:00:00.000Z"),
    });
  });

  it("rejects amounts with more than two decimals", async () => {
    await expect(
      createPaymentSchema.validate({
        customer_id: 8,
        method_payment_id: 3,
        amount: 1.234,
      }),
    ).rejects.toThrow("two decimals");
  });

  it.each([0, -1, "abc", "", null])("rejects the amount %p", async (amount) => {
    await expect(
      createPaymentSchema.validate({
        customer_id: 8,
        method_payment_id: 3,
        amount,
      }),
    ).rejects.toThrow();
  });

  it("rejects malformed ids and long text", async () => {
    await expect(
      createPaymentSchema.validate({
        customer_id: "abc",
        method_payment_id: 3,
        amount: 1,
      }),
    ).rejects.toThrow();

    await expect(
      createPaymentSchema.validate({
        customer_id: 8,
        method_payment_id: 3,
        amount: 1,
        reference: "x".repeat(101),
      }),
    ).rejects.toThrow("100");
  });

  it("accepts the immutable fields in an update and validates the amount", async () => {
    await expect(
      updatePaymentSchema.validate({
        customer_id: 8,
        method_payment_id: 3,
        currency_id: 2,
        amount: 100,
        reference: null,
      }),
    ).resolves.toMatchObject({
      customer_id: 8,
      method_payment_id: 3,
      currency_id: 2,
      amount: 100,
    });

    await expect(
      updatePaymentSchema.validate({ amount: 1.234 }),
    ).rejects.toThrow();
  });

  it("checks two decimals for numbers and numeric strings", () => {
    expect(hasAtMostTwoDecimals(100.5, 100.5)).toBe(true);
    expect(hasAtMostTwoDecimals(100.501, 100.501)).toBe(false);
    expect(hasAtMostTwoDecimals(100.5, "100.50")).toBe(true);
    expect(hasAtMostTwoDecimals(100.5, "1e2")).toBe(false);
    expect(hasAtMostTwoDecimals(undefined, undefined)).toBe(true);
  });

  it("parses date-only filters and adds days", () => {
    expect(parseDateOnly("2026-11-01")).toEqual(
      new Date("2026-11-01T00:00:00.000Z"),
    );
    expect(parseDateOnly("2026-11-31")).toBeNull();
    expect(parseDateOnly("01/11/2026")).toBeNull();
    expect(parseDateOnly(123)).toBeNull();
    expect(addDays(new Date("2026-11-01T00:00:00.000Z"), 1)).toEqual(
      new Date("2026-11-02T00:00:00.000Z"),
    );
  });
});
