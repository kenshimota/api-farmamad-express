const {
  toPublicAllocation,
  toPublicAllocationWithInvoice,
} = require("./serializer");

const {
  ALLOCATION,
  CURRENCY,
  INVOICE,
  NOW,
} = require("../../test/helpers/invoice-payments-doubles");

describe("invoice payment serializer", () => {
  it("serializes an allocation with its payment method and currency", () => {
    expect(toPublicAllocation(ALLOCATION)).toEqual({
      id: 11,
      payment_id: 5,
      amount: 10,
      currency: {
        id: 2,
        code: "USDT",
        name: "Tether",
        symbol: "$",
      },
      applied_amount: 20,
      exchange_rate: 2,
      allocated_at: NOW.toISOString(),
      method_payment: { id: 4, label: "Binance Farmamad" },
      method_payment_type: { id: 2, code: "BINANCE", name: "Binance" },
    });
  });

  it("only exposes created_by when asked", () => {
    expect(toPublicAllocation(ALLOCATION, { includeCreatedBy: true })).toEqual(
      expect.objectContaining({
        created_by: { id: 1, username: "admin", email: "admin@example.com" },
      }),
    );
    expect(toPublicAllocation(ALLOCATION)).not.toHaveProperty("created_by");
  });

  it("tolerates missing relations and timestamps", () => {
    const result = toPublicAllocation({
      ...ALLOCATION,
      allocated_at: null,
      payment: null,
    });

    expect(result.currency).toBeNull();
    expect(result.method_payment).toBeNull();
    expect(result.method_payment_type).toBeNull();
    expect(result.allocated_at).toBeNull();
  });

  it("keeps an ISO string timestamp and nulls a missing author", () => {
    const result = toPublicAllocation(
      { ...ALLOCATION, allocated_at: "2026-11-01T13:00:00.000Z" },
      { includeCreatedBy: true },
    );

    expect(result.allocated_at).toBe("2026-11-01T13:00:00.000Z");
    expect(
      toPublicAllocation(
        { ...ALLOCATION, created_by: null },
        {
          includeCreatedBy: true,
        },
      ).created_by,
    ).toBeNull();
  });

  it("returns null balance_due when the invoice amounts are invalid", () => {
    expect(
      toPublicAllocationWithInvoice(ALLOCATION, {
        ...INVOICE,
        total: null,
        paid_amount: "10.00",
      }).invoice.balance_due,
    ).toBeNull();
  });

  it("nests the updated invoice summary in the creation response", () => {
    expect(
      toPublicAllocationWithInvoice(ALLOCATION, {
        ...INVOICE,
        total: "25.00",
        paid_amount: "20.00",
        payment_status: "partial",
      }),
    ).toEqual(
      expect.objectContaining({
        id: 11,
        amount: 10,
        applied_amount: 20,
        currency: {
          id: CURRENCY.id,
          code: CURRENCY.code,
          name: CURRENCY.name,
          symbol: CURRENCY.symbol,
        },
        invoice: {
          id: 1,
          number: 1,
          total: 25,
          paid_amount: 20,
          balance_due: 5,
          payment_status: "partial",
        },
      }),
    );
  });

  it("summarizes invoice payment history without wallet data", () => {
    const result = toPublicAllocationWithInvoice(ALLOCATION, INVOICE);

    expect(result.invoice).not.toHaveProperty("wallet");
    expect(result.invoice).not.toHaveProperty("paid_amount_currency");
  });
});
