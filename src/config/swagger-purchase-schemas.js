const purchaseSchemas = {
  PurchaseItemInput: {
    type: "object",
    required: ["product_id", "item_state_id", "quantity", "unit_cost"],
    properties: {
      product_id: { type: "integer", minimum: 1, example: 15 },
      item_state_id: { type: "integer", minimum: 1, example: 1 },
      quantity: {
        type: "integer",
        minimum: 1,
        maximum: 1000000,
        example: 40,
      },
      unit_cost: {
        type: "number",
        minimum: 0,
        multipleOf: 0.01,
        example: 20.0,
      },
    },
  },
  PurchaseItemUpdate: {
    type: "object",
    description: "Any subset of the line fields",
    properties: {
      product_id: { type: "integer", minimum: 1, example: 15 },
      item_state_id: { type: "integer", minimum: 1, example: 1 },
      quantity: {
        type: "integer",
        minimum: 1,
        maximum: 1000000,
        example: 40,
      },
      unit_cost: {
        type: "number",
        minimum: 0,
        multipleOf: 0.01,
        example: 20.0,
      },
    },
  },
  PurchaseItem: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      product_id: { type: "integer", example: 15 },
      item_state_id: { type: "integer", example: 1 },
      quantity: { type: "integer", minimum: 1, example: 40 },
      unit_cost: { type: "number", example: 20.0 },
      subtotal: { type: "number", example: 800.0 },
    },
  },
  Purchase: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      number: {
        type: "integer",
        description: "Ascending number assigned by the server",
        example: 1,
      },
      supplier_id: { type: "integer", example: 1 },
      status: {
        type: "string",
        enum: ["draft", "confirmed", "cancelled"],
        example: "draft",
      },
      subtotal: { type: "number", example: 837.5 },
      tax_rate: { type: "number", minimum: 0, maximum: 100, example: 16 },
      tax_amount: { type: "number", example: 134.0 },
      total: { type: "number", example: 971.5 },
      notes: {
        type: "string",
        nullable: true,
        maxLength: 1000,
        example: "Reposición mensual",
      },
      confirmed_at: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "Only present once the purchase is confirmed",
        example: "2026-10-29T10:15:31.002Z",
      },
      items: {
        type: "array",
        description: "Present when include=items or in the detail endpoints",
        items: { $ref: "#/components/schemas/PurchaseItem" },
      },
    },
  },
  PurchaseDetail: {
    allOf: [
      { $ref: "#/components/schemas/Purchase" },
      {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/PurchaseItem" },
          },
          supplier: { $ref: "#/components/schemas/Supplier" },
        },
      },
    ],
  },
};

module.exports = purchaseSchemas;
