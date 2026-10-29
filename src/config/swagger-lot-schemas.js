const schemas = {
  LotProduct: {
    type: "object",
    properties: {
      id: { type: "integer", example: 15 },
      name: { type: "string", example: "Ibuprofeno 800 mg" },
      reference: { type: "string", example: "IBU-800" },
    },
  },
  LotItemState: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "sellable" },
      label: { type: "string", example: "Vendible" },
      is_sellable: { type: "boolean", example: true },
    },
  },
  LotWarehouse: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "Bodega Central" },
    },
  },
  LotShelf: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      code: { type: "string", example: "A1" },
      name: { type: "string", nullable: true, example: "Estante A1" },
    },
  },
  LotSection: {
    type: "object",
    properties: {
      id: { type: "integer", example: 2 },
      code: { type: "string", example: "A1-02" },
      name: { type: "string", nullable: true, example: "Nivel 2" },
    },
  },
  Lot: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      number: {
        type: "string",
        description: "Unique per product ignoring case, 1–100 characters",
        example: "L-2026-001",
      },
      product_id: { type: "integer", example: 15 },
      expiration_date: {
        type: "string",
        format: "date",
        description: "Date without time; an already expired lot is valid",
        example: "2027-03-31",
      },
      item_state_id: { type: "integer", example: 1 },
      stock: { type: "integer", minimum: 0, example: 120 },
      reserved: { type: "integer", minimum: 0, example: 15 },
      available: {
        type: "integer",
        description: "Calculated as stock - reserved, never stored",
        example: 105,
      },
      warehouse_id: { type: "integer", example: 1 },
      shelf_id: { type: "integer", example: 1 },
      section_id: { type: "integer", example: 2 },
      product: { $ref: "#/components/schemas/LotProduct" },
      item_state: { $ref: "#/components/schemas/LotItemState" },
      warehouse: { $ref: "#/components/schemas/LotWarehouse" },
      shelf: { $ref: "#/components/schemas/LotShelf" },
      section: { $ref: "#/components/schemas/LotSection" },
    },
  },
};

module.exports = schemas;
