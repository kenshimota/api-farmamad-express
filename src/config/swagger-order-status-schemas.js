const orderStatusSchemas = {
  OrderStatus: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      code: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{1,19}$",
        example: "draft",
      },
      name: { type: "string", example: "Borrador" },
      description: { type: "string", nullable: true, example: null },
      sort_order: { type: "integer", minimum: 0, example: 10 },
      next_status_code: {
        type: "string",
        nullable: true,
        example: "request",
      },
      is_terminal: {
        type: "boolean",
        description: "Derived from next_status_code === null",
        example: false,
      },
      is_system: {
        type: "boolean",
        description: "True for the five base statuses",
        example: true,
      },
    },
  },
};

module.exports = orderStatusSchemas;
