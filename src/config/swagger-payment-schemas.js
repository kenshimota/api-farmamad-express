const CURRENCY = { $ref: "#/components/schemas/CurrencySummary" };

const schemas = {
  CustomerWallet: {
    type: "object",
    description:
      "Money available for one customer in one currency; created on the first deposit",
    properties: {
      id: { type: "integer", example: 5 },
      customer_id: { type: "integer", example: 8 },
      currency_id: { type: "integer", example: 2 },
      currency: CURRENCY,
      balance: {
        type: "number",
        format: "double",
        description: "Current balance with DECIMAL(14,2) precision",
        example: 100,
      },
    },
  },
  WalletTransaction: {
    type: "object",
    description:
      "Append-only wallet movement. Positive amounts credit, negative amounts debit.",
    properties: {
      id: { type: "integer", example: 1 },
      transaction_type: {
        type: "string",
        enum: ["deposit", "invoice_payment"],
        example: "deposit",
      },
      amount: { type: "number", example: 100 },
      balance_after: { type: "number", example: 100 },
      currency: CURRENCY,
      payment_id: { type: "integer", nullable: true, example: 1 },
      invoice_id: {
        type: "integer",
        nullable: true,
        description:
          "Reserved for HU-40/HU-43; the invoices table does not exist in this branch yet",
        example: null,
      },
      payment_allocation_id: {
        type: "integer",
        nullable: true,
        description: "Reserved for HU-43",
        example: null,
      },
      description: {
        type: "string",
        nullable: true,
        example: "Depósito Binance",
      },
      created_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-01T12:00:00.000Z",
      },
      created_by: {
        type: "object",
        nullable: true,
        description:
          "Only present for admin and seller requests, never for the customer",
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "maria" },
          email: {
            type: "string",
            format: "email",
            example: "maria@farmamad.com",
          },
        },
      },
    },
  },
  Payment: {
    type: "object",
    description: "Money actually received from a customer",
    properties: {
      id: { type: "integer", example: 1 },
      customer_id: { type: "integer", example: 8 },
      method_payment_id: { type: "integer", example: 3 },
      method_payment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          label: { type: "string", example: "Binance Farmamad" },
        },
      },
      currency_id: { type: "integer", example: 2 },
      currency: CURRENCY,
      amount: { type: "number", example: 100 },
      paid_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-01T12:00:00.000Z",
      },
      reference: { type: "string", nullable: true, example: "TRX-123" },
      notes: { type: "string", nullable: true, example: "Depósito Binance" },
    },
  },
  PaymentWithWallet: {
    allOf: [
      { $ref: "#/components/schemas/Payment" },
      {
        type: "object",
        properties: {
          wallet: { $ref: "#/components/schemas/CustomerWallet" },
        },
      },
    ],
  },
};

module.exports = schemas;
