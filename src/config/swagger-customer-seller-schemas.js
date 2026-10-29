const schemas = {
  CustomerSellerCustomer: {
    type: "object",
    properties: {
      id: { type: "integer", example: 8 },
      fullName: { type: "string", example: "Juan Pérez" },
      email: {
        type: "string",
        format: "email",
        example: "juan@example.com",
      },
      direction: {
        type: "string",
        example: "Av. Monseñor Rivero 123",
      },
    },
  },
  CustomerSellerSeller: {
    type: "object",
    properties: {
      id: { type: "integer", example: 12 },
      username: { type: "string", example: "vendedor1" },
      email: {
        type: "string",
        format: "email",
        example: "vendedor1@farmamad.com",
      },
      name: { type: "string", nullable: true, example: "Carlos Gómez" },
    },
  },
  CustomerSeller: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      customer_id: { type: "integer", example: 8 },
      seller_id: { type: "integer", example: 12 },
      assigned_at: {
        type: "string",
        format: "date-time",
        description:
          "Server-managed timestamp; refreshed when the assignment is reassigned",
        example: "2026-10-29T16:00:00.000Z",
      },
      customer: { $ref: "#/components/schemas/CustomerSellerCustomer" },
      seller: { $ref: "#/components/schemas/CustomerSellerSeller" },
    },
  },
};

module.exports = schemas;
