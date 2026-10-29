const schemas = {
  MethodPayment: {
    type: "object",
    description:
      "Concrete payment method whose currency is inherited from its type",
    properties: {
      id: { type: "integer", example: 1 },
      method_payment_type_id: { type: "integer", example: 1 },
      label: {
        type: "string",
        maxLength: 100,
        description: "Unique inside its type, ignoring case",
        example: "PayPal Farmamad",
      },
      details: {
        type: "object",
        additionalProperties: true,
        description:
          "Plain JSONB object validated against the type fields; text values are trimmed",
        example: { email: "pagos@farmamad.com" },
      },
      is_active: { type: "boolean", example: true },
      currency_id: {
        type: "integer",
        description: "Inherited from method_payment_type.currency_id",
        example: 3,
      },
      currency: {
        $ref: "#/components/schemas/CurrencySummary",
        description: "Currency inherited from the payment type",
      },
      method_payment_type: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          code: { type: "string", example: "PAYPAL" },
          name: { type: "string", example: "PayPal" },
        },
      },
    },
  },
};

module.exports = schemas;
