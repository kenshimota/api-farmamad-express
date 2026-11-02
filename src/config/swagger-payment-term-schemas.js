const paymentTermSchemas = {
  PaymentTerm: {
    type: "object",
    properties: {
      id: { type: "integer", example: 2 },
      code: {
        type: "string",
        description:
          "Stable key, lowercase, unique ignoring case and immutable",
        pattern: "^[a-z][a-z0-9_]{1,29}$",
        example: "credit_10",
      },
      name: {
        type: "string",
        maxLength: 100,
        example: "Crédito 10 días",
      },
      description: {
        type: "string",
        maxLength: 255,
        nullable: true,
        example: "Pago a 10 días",
      },
      days: {
        type: "integer",
        minimum: 0,
        maximum: 3650,
        description: "0 means cash; greater than 0 means credit",
        example: 10,
      },
      is_active: {
        type: "boolean",
        description: "Inactive terms cannot be assigned to new records",
        example: true,
      },
    },
  },
  PaymentTermSummary: {
    type: "object",
    description:
      "Compact payment term nested in customers, orders and invoices",
    properties: {
      id: { type: "integer", example: 3 },
      code: { type: "string", example: "credit_15" },
      name: { type: "string", example: "Crédito 15 días" },
      days: { type: "integer", example: 15 },
    },
  },
};

module.exports = paymentTermSchemas;
