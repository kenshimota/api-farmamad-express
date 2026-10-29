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
    },
  },
};

module.exports = customerSchemas;
