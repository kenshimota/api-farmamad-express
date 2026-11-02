const {
  toPublicMethodPaymentSummary,
  toPublicPayment,
  toPublicPaymentWithWallet,
} = require("./serializer");

const CURRENCY = { id: 2, code: "USDT", name: "Tether", symbol: "$" };
const PAYMENT = {
  id: 1,
  customer_id: 8,
  method_payment_id: 3,
  method_payment: { id: 3, label: "Binance Farmamad" },
  currency_id: 2,
  currency: CURRENCY,
  amount: "100.00",
  paid_at: new Date("2026-11-01T12:00:00.000Z"),
  reference: "TRX-123",
  notes: "Depósito",
};
const WALLET = {
  id: 5,
  customer_id: 8,
  currency_id: 2,
  currency: CURRENCY,
  balance: "100.00",
};

describe("payment serializer", () => {
  it("serializes the payment with nested method and currency", () => {
    expect(toPublicPayment(PAYMENT)).toEqual({
      id: 1,
      customer_id: 8,
      method_payment_id: 3,
      method_payment: { id: 3, label: "Binance Farmamad" },
      currency_id: 2,
      currency: CURRENCY,
      amount: 100,
      paid_at: "2026-11-01T12:00:00.000Z",
      reference: "TRX-123",
      notes: "Depósito",
    });
  });

  it("keeps missing relations as null and timestamps already serialized", () => {
    expect(
      toPublicPayment({
        ...PAYMENT,
        method_payment: null,
        currency: null,
        paid_at: "2026-11-01T12:00:00.000Z",
      }),
    ).toMatchObject({
      method_payment: null,
      currency: null,
      paid_at: "2026-11-01T12:00:00.000Z",
    });
  });

  it("summarizes a method and handles null", () => {
    expect(toPublicMethodPaymentSummary({ id: 3, label: "Binance" })).toEqual({
      id: 3,
      label: "Binance",
    });
    expect(toPublicMethodPaymentSummary(null)).toBeNull();
  });

  it("adds the credited wallet to the creation response", () => {
    expect(toPublicPaymentWithWallet(PAYMENT, WALLET)).toMatchObject({
      id: 1,
      wallet: {
        id: 5,
        customer_id: 8,
        currency_id: 2,
        currency: CURRENCY,
        balance: 100,
      },
    });
  });
});
