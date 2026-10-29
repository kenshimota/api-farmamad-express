const schemas = {
  Tax: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      code: {
        type: "string",
        description:
          "Unique ignoring case, uppercase, 2–20 characters; immutable after creation",
        example: "IVA",
      },
      name: { type: "string", example: "Impuesto al Valor Agregado" },
      rate: {
        type: "number",
        format: "double",
        minimum: 0,
        maximum: 100,
        description:
          "Percentage with at most two decimals; 16 means 16 %, not an amount",
        example: 16,
      },
      description: {
        type: "string",
        nullable: true,
        example: "IVA general",
      },
      is_active: {
        type: "boolean",
        description:
          "Inactive taxes stay stored but can be hidden from selections",
        example: true,
      },
    },
  },
};

module.exports = schemas;
