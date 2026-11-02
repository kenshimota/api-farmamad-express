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
          "Invoice credited by an invoice_payment movement; null for deposits",
        example: null,
      },
      payment_allocation_id: {
        type: "integer",
        nullable: true,
        description:
          "Immutable allocation that produced the invoice_payment movement",
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
      status: {
        type: "string",
        enum: ["pending", "conciliated", "rejected"],
        example: "pending",
      },
      status_name: { type: "string", example: "Pendiente" },
      rejection_reason: {
        type: "string",
        nullable: true,
        example: null,
        description: "Only set when status is rejected",
      },
      reference_image_id: {
        type: "integer",
        nullable: true,
        example: 20,
      },
      reference_image: {
        allOf: [{ $ref: "#/components/schemas/Image" }],
        nullable: true,
      },
    },
  },
  PaymentHistoryEvent: {
    type: "object",
    description:
      "One append-only payment status change with its actor and timestamp",
    properties: {
      id: { type: "integer", example: 1 },
      from_status: {
        type: "string",
        nullable: true,
        enum: ["pending", "conciliated", "rejected"],
        example: null,
      },
      to_status: {
        type: "string",
        enum: ["pending", "conciliated", "rejected"],
        example: "pending",
      },
      reason: { type: "string", nullable: true, example: null },
      created_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-02T15:00:00.000Z",
      },
      actor: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "admin" },
          email: {
            type: "string",
            format: "email",
            example: "admin@farmamad.com",
          },
        },
      },
    },
  },
  PaymentWithWallet: {
    allOf: [
      { $ref: "#/components/schemas/Payment" },
      {
        type: "object",
        properties: {
          wallet: {
            allOf: [{ $ref: "#/components/schemas/CustomerWallet" }],
            nullable: true,
            description: "Null while the payment is pending or rejected",
          },
        },
      },
    ],
  },
};

module.exports = schemas;
