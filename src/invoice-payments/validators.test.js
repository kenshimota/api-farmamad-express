const {
  AMOUNT_MESSAGE,
  PAYMENT_ID_MESSAGE,
  applyInvoicePaymentSchema,
  parseInvoicePaymentBody,
} = require("./validators");

describe("invoice payment validators", () => {
  it("exposes the documented required fields and messages", () => {
    const { REQUIRED_INVOICE_PAYMENT_FIELDS } = require("./validators");

    expect(REQUIRED_INVOICE_PAYMENT_FIELDS).toEqual(["payment_id", "amount"]);
    expect(PAYMENT_ID_MESSAGE).toBe("payment_id must be a positive integer");
    expect(AMOUNT_MESSAGE).toBe(
      "amount must be a positive number with two decimals",
    );
  });

  it("accepts a positive integer payment id and a two-decimal amount", async () => {
    await expect(
      applyInvoicePaymentSchema.validate(
        {
          payment_id: "5",
          amount: "12.50",
          ignored: true,
        },
        { stripUnknown: true },
      ),
    ).resolves.toEqual({ payment_id: 5, amount: 12.5 });
    await expect(
      applyInvoicePaymentSchema.validate({ payment_id: 5, amount: 1 }),
    ).resolves.toEqual({ payment_id: 5, amount: 1 });
  });

  it.each([0, -1, 1.5, "abc", null])(
    "rejects the payment id %p",
    async (paymentId) => {
      await expect(
        applyInvoicePaymentSchema.validate({
          payment_id: paymentId,
          amount: 10,
        }),
      ).rejects.toThrow(PAYMENT_ID_MESSAGE);
    },
  );

  it.each([0, -5, 0.001, 10.123, "abc", null])(
    "rejects the amount %p",
    async (amount) => {
      await expect(
        applyInvoicePaymentSchema.validate({
          payment_id: 5,
          amount,
        }),
      ).rejects.toThrow(AMOUNT_MESSAGE);
    },
  );

  it("parses a body into the service values", () => {
    expect(
      parseInvoicePaymentBody({ payment_id: 5, amount: 10, extra: "x" }),
    ).toEqual({ payment_id: 5, amount: 10 });
  });
});
