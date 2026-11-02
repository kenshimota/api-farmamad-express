const schemas = {
  WarehouseInboxUser: {
    type: "object",
    properties: {
      id: { type: "integer", example: 7 },
      username: { type: "string", example: "almacen" },
    },
  },
  WarehouseInboxPurchase: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      number: { type: "integer", example: 1 },
      supplier_id: { type: "integer", example: 1 },
    },
  },
  WarehouseInboxLot: {
    type: "object",
    properties: {
      id: { type: "integer", example: 40 },
      number: { type: "string", example: "LOTE-1" },
      product_id: { type: "integer", example: 15 },
      expiration_date: {
        type: "string",
        format: "date",
        example: "2027-03-31",
      },
      item_state_id: { type: "integer", example: 1 },
      stock: { type: "integer", example: 100 },
      reserved: { type: "integer", example: 0 },
      available: {
        type: "integer",
        description: "0 while the lot is not located",
        example: 0,
      },
      location_status: {
        type: "string",
        enum: ["pending", "in_progress", "located"],
        example: "pending",
      },
      location_started_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      location_started_by: { type: "integer", nullable: true, example: 7 },
      located_at: {
        type: "string",
        format: "date-time",
        nullable: true,
      },
      located_by: {
        description:
          "Nested user in the inbox listing; raw id in start/location responses",
        oneOf: [
          { $ref: "#/components/schemas/WarehouseInboxUser" },
          { type: "integer", nullable: true },
        ],
      },
      created_at: { type: "string", format: "date-time" },
      product: { $ref: "#/components/schemas/LotProduct" },
      item_state: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "sellable" },
          label: { type: "string", example: "Vendible" },
        },
      },
      purchase: { $ref: "#/components/schemas/WarehouseInboxPurchase" },
      purchase_item_id: { type: "integer", nullable: true, example: 1 },
      started_by: {
        allOf: [{ $ref: "#/components/schemas/WarehouseInboxUser" }],
        nullable: true,
      },
    },
  },
};

module.exports = schemas;
