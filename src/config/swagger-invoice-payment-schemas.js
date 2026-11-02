const CURRENCY = { $ref: "#/components/schemas/CurrencySummary" };

const METHOD_PAYMENT = {
  type: "object",
  properties: {
    id: { type: "integer", example: 3 },
    label: { type: "string", example: "Binance Farmamad" },
  },
};

const METHOD_PAYMENT_TYPE = {
  type: "object",
  properties: {
    id: { type: "integer", example: 2 },
    code: { type: "string", example: "BINANCE" },
    name: { type: "string", example: "Binance" },
  },
};

const CREATED_BY = {
  type: "object",
  description: "Only present for admin and seller responses",
  properties: {
    id: { type: "integer", example: 1 },
    username: { type: "string", example: "maria" },
    email: { type: "string", format: "email", example: "maria@farmamad.com" },
  },
};

const ALLOCATION_FIELDS = {
  id: { type: "integer", example: 1 },
  payment_id: { type: "integer", example: 1 },
  amount: {
    type: "number",
    description: "Debited from the wallet in the payment currency",
    example: 25,
  },
  currency: CURRENCY,
  applied_amount: {
    type: "number",
    description: "Credited to the invoice in the invoice currency",
    example: 25,
  },
  exchange_rate: {
    type: "number",
    description: "payment currency rate / invoice currency rate",
    example: 1.124,
  },
  allocated_at: {
    type: "string",
    format: "date-time",
    example: "2026-11-01T13:00:00.000Z",
  },
};

const schemas = {
  PaymentAllocation: {
    type: "object",
    description:
      "Immutable application of one received payment to one invoice; ordered by allocated_at and id ascending",
    properties: {
      ...ALLOCATION_FIELDS,
      method_payment: METHOD_PAYMENT,
      method_payment_type: METHOD_PAYMENT_TYPE,
      created_by: CREATED_BY,
    },
  },
  InvoicePaymentHistory: {
    type: "object",
    description:
      "Summarized payment history row nested in an invoice detail, without the staff user nor wallet balances",
    properties: {
      payment_id: { type: "integer", example: 1 },
      amount: { type: "number", example: 25 },
      currency: CURRENCY,
      applied_amount: { type: "number", example: 25 },
      allocated_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-01T13:00:00.000Z",
      },
    },
  },
  InvoicePaymentCreated: {
    type: "object",
    description: "Created allocation plus the updated invoice summary",
    properties: {
      ...ALLOCATION_FIELDS,
      invoice_id: { type: "integer", example: 1 },
      invoice: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          number: { type: "integer", example: 1 },
          total: { type: "number", example: 25 },
          paid_amount: { type: "number", example: 25 },
          balance_due: { type: "number", example: 0 },
          payment_status: {
            type: "string",
            enum: ["pending", "partial", "paid"],
            example: "paid",
          },
        },
      },
    },
  },
};

module.exports = schemas;
