const {
  toPublicMethodPaymentSummary,
  toPublicPayment,
  toPublicPaymentWithWallet,
} = require("./serializer");

const CURRENCY = { id: 2, code: "USDT", name: "Tether", symbol: "$" };
const IMAGE = {
  id: 20,
  url: "http://localhost:3001/uploads/payments/a.png",
  pathname: "/uploads/payments/a.png",
  reference: "payment-reference-a",
  thumbnail: "http://localhost:3001/uploads/payments/a-thumb.webp",
};
const STATUS = { code: "pending", name: "Pendiente" };
const HISTORY = {
  id: 1,
  from_status: null,
  to_status: "pending",
  reason: null,
  createdAt: new Date("2026-11-01T12:00:00.000Z"),
  actor: { id: 1, username: "admin", email: "admin@farmamad.com" },
};
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
  status: "pending",
  status_detail: STATUS,
  rejection_reason: null,
  reference_image_id: 20,
  reference_image: IMAGE,
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
      status: "pending",
      status_name: "Pendiente",
      rejection_reason: null,
      reference_image_id: 20,
      reference_image: IMAGE,
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

  it("serializes a pending payment with wallet null and no history", () => {
    expect(toPublicPaymentWithWallet(PAYMENT, null)).toMatchObject({
      status: "pending",
      status_name: "Pendiente",
      rejection_reason: null,
      reference_image: IMAGE,
      wallet: null,
    });
  });

  it("serializes the history only when requested", () => {
    const payment = { ...PAYMENT, history: [HISTORY] };

    expect(toPublicPayment(payment)).not.toHaveProperty("history");
    expect(toPublicPayment(payment, { includeHistory: true })).toMatchObject({
      history: [
        {
          id: 1,
          from_status: null,
          to_status: "pending",
          reason: null,
          created_at: "2026-11-01T12:00:00.000Z",
          actor: {
            id: 1,
            username: "admin",
            email: "admin@farmamad.com",
          },
        },
      ],
    });
  });

  it("handles a payment without status relations", () => {
    expect(
      toPublicPayment({
        ...PAYMENT,
        status_detail: null,
        reference_image: null,
        reference_image_id: null,
      }),
    ).toMatchObject({
      status: "pending",
      status_name: null,
      reference_image: null,
      reference_image_id: null,
    });
  });
});
