const schemas = {
  MethodPaymentTypeField: {
    type: "object",
    description:
      "Definition of one data field required by concrete payment methods of a type",
    required: ["key", "label", "type", "required"],
    additionalProperties: false,
    properties: {
      key: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{1,40}$",
        description: "Unique within the type",
        example: "email",
      },
      label: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        example: "Correo de PayPal",
      },
      type: {
        type: "string",
        enum: ["text", "email", "phone", "integer", "boolean"],
        example: "email",
      },
      required: { type: "boolean", example: true },
      max_length: {
        type: "integer",
        minimum: 1,
        maximum: 255,
        description: "Only allowed on text, email and phone fields",
        example: 150,
      },
    },
  },
  MethodPaymentType: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      code: {
        type: "string",
        description:
          "Unique ignoring case, uppercase, 2–30 characters; immutable after creation",
        example: "PAYPAL",
      },
      name: { type: "string", example: "PayPal" },
      currency_id: { type: "integer", example: 3 },
      currency: {
        $ref: "#/components/schemas/CurrencySummary",
        description: "Currency inherited by every concrete payment method",
      },
      fields: {
        type: "array",
        maxItems: 20,
        items: { $ref: "#/components/schemas/MethodPaymentTypeField" },
      },
      description: {
        type: "string",
        nullable: true,
        example: "Pagos por PayPal",
      },
      is_active: {
        type: "boolean",
        description:
          "Inactive types stay stored but can be hidden from selections",
        example: true,
      },
    },
  },
};

module.exports = schemas;
