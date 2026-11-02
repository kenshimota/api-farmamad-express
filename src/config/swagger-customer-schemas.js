const customerSchemas = {
  Customer: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      fullName: { type: "string", example: "Juan Pérez" },
      latitude: {
        type: "number",
        description: "Latitude with up to 7 decimals",
        example: -17.7833,
      },
      longitude: {
        type: "number",
        description: "Longitude with up to 7 decimals",
        example: -63.1821,
      },
      direction: {
        type: "string",
        example: "Av. Monseñor Rivero 123",
      },
      email: {
        type: "string",
        format: "email",
        example: "juan@example.com",
      },
      price_list_id: {
        type: "integer",
        nullable: true,
        example: 1,
      },
      price_list: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PriceListSummary" }],
      },
      payment_term_id: {
        type: "integer",
        nullable: true,
        example: 2,
      },
      payment_term: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PaymentTermSummary" }],
      },
    },
  },
};

module.exports = customerSchemas;
