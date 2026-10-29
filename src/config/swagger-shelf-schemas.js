const schemas = {
  ShelfSection: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      shelf_id: { type: "integer", example: 1 },
      code: {
        type: "string",
        description:
          "Unique inside its shelf ignoring case, uppercase, 1–50 characters",
        example: "A1-01",
      },
      name: { type: "string", nullable: true, example: "Nivel 1" },
      description: {
        type: "string",
        nullable: true,
        example: "Productos de rotación alta",
      },
    },
  },
  Shelf: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      warehouse_id: { type: "integer", example: 1 },
      code: {
        type: "string",
        description:
          "Unique inside its warehouse ignoring case, uppercase, 1–50 characters",
        example: "A1",
      },
      name: { type: "string", nullable: true, example: "Estante A1" },
      description: {
        type: "string",
        nullable: true,
        example: "Pasillo principal",
      },
      sections: {
        type: "array",
        description:
          "Present in the detail, the creation response and list with include=sections",
        items: { $ref: "#/components/schemas/ShelfSection" },
      },
    },
  },
};

module.exports = schemas;
