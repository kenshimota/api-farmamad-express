const priceListSchemas = {
  PriceList: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "Mayorista 30" },
      description: {
        type: "string",
        nullable: true,
        example: "Margen del 30 % para mayoristas",
      },
      percentage: {
        type: "number",
        description:
          "Margin over the cost in the [0, 100) range, serialized as a number",
        example: 30,
      },
    },
  },
  PriceListSummary: {
    type: "object",
    description:
      "Price list assigned to a customer; the margin is never exposed",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "Mayorista 30" },
    },
  },
};

module.exports = priceListSchemas;
