const schemas = {
  Currency: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      code: {
        type: "string",
        description: "Unique ignoring case, uppercase, 2–10 characters",
        example: "USDT",
      },
      name: { type: "string", example: "Tether" },
      symbol: { type: "string", example: "$" },
      rate: {
        type: "number",
        format: "double",
        description:
          "Amount of VES that one unit of the currency is worth, with DECIMAL(18,6) precision",
        example: 1000.29,
      },
      is_base: {
        type: "boolean",
        description: "Only VES is base and keeps rate 1",
        example: false,
      },
      is_active: { type: "boolean", example: true },
    },
  },
  CurrencyRateHistory: {
    type: "object",
    properties: {
      id: { type: "integer", example: 5 },
      currency_id: { type: "integer", example: 2 },
      previous_rate: {
        type: "number",
        nullable: true,
        description: "Null on the initial creation row",
        example: 1000.29,
      },
      new_rate: { type: "number", example: 1005.75 },
      changed_by: {
        type: "object",
        nullable: true,
        description: "Null for the seeded data or when the user was deleted",
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "admin" },
          email: { type: "string", example: "admin@farmamad.com" },
        },
      },
      changed_at: {
        type: "string",
        format: "date-time",
        example: "2026-10-29T15:30:00.000Z",
      },
      reason: { type: "string", nullable: true, example: "seed" },
    },
  },
};

module.exports = schemas;
