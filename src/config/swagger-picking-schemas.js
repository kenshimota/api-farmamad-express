const pickingSchemas = {
  PickingWarehouse: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "Bodega Central" },
    },
  },
  PickingShelf: {
    type: "object",
    nullable: true,
    properties: {
      id: { type: "integer", example: 2 },
      code: { type: "string", example: "A1" },
      name: { type: "string", nullable: true, example: "Estante A1" },
    },
  },
  PickingSection: {
    type: "object",
    nullable: true,
    properties: {
      id: { type: "integer", example: 3 },
      code: { type: "string", example: "A1-03" },
      name: { type: "string", nullable: true, example: "Nivel 3" },
    },
  },
  PickingLot: {
    type: "object",
    properties: {
      id: { type: "integer", example: 40 },
      number: { type: "string", example: "LOTE-1" },
      expiration_date: {
        type: "string",
        format: "date",
        description: "Date without time (`YYYY-MM-DD`)",
        example: "2027-03-31",
      },
      location_status: {
        type: "string",
        enum: ["pending", "in_progress", "located"],
        example: "located",
      },
      stock: { type: "integer", minimum: 0, example: 100 },
      reserved: { type: "integer", minimum: 0, example: 20 },
      available: {
        type: "integer",
        description:
          "Remaining inventory (stock - reserved); reference only, not the quantity to pack",
        example: 80,
      },
      warehouse: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PickingWarehouse" }],
      },
      shelf: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PickingShelf" }],
      },
      section: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PickingSection" }],
      },
    },
  },
  PickingAllocation: {
    type: "object",
    properties: {
      allocation_id: { type: "integer", example: 31 },
      quantity: {
        type: "integer",
        minimum: 0,
        description: "Units to pack from this lot",
        example: 6,
      },
      status: {
        type: "string",
        enum: ["reserved", "consumed", "released"],
        example: "reserved",
      },
      lot: { $ref: "#/components/schemas/PickingLot" },
    },
  },
  PickingItem: {
    type: "object",
    properties: {
      order_item_id: { type: "integer", example: 20 },
      product_id: { type: "integer", example: 15 },
      item_state_id: { type: "integer", example: 1 },
      quantity: { type: "integer", minimum: 0, example: 10 },
      allocated_quantity: {
        type: "integer",
        minimum: 0,
        description: "Sum of the returned allocations",
        example: 10,
      },
      pending_quantity: {
        type: "integer",
        minimum: 0,
        description: "quantity - allocated_quantity, never negative",
        example: 0,
      },
      product: { $ref: "#/components/schemas/OrderProductSummary" },
      item_state: { $ref: "#/components/schemas/OrderItemStateSummary" },
      lots: {
        type: "array",
        description: "Allocations ordered FEFO by expiration date and lot id",
        items: { $ref: "#/components/schemas/PickingAllocation" },
      },
    },
  },
  PickingSummary: {
    type: "object",
    properties: {
      lines_count: { type: "integer", minimum: 0, example: 2 },
      lots_count: { type: "integer", minimum: 0, example: 3 },
      ordered_units: { type: "integer", minimum: 0, example: 30 },
      allocated_units: { type: "integer", minimum: 0, example: 30 },
      pending_units: { type: "integer", minimum: 0, example: 0 },
      ready: {
        type: "boolean",
        description:
          "true only when every line is fully allocated and has no pending units",
        example: true,
      },
    },
  },
  PickingOrderHeader: {
    type: "object",
    properties: {
      id: { type: "integer", example: 10 },
      number: { type: "integer", example: 10 },
      status: {
        type: "string",
        enum: ["draft", "request", "generate", "invoiced", "cancelled"],
        example: "generate",
      },
      customer_id: { type: "integer", example: 8 },
      delivery_address: {
        type: "string",
        example: "Av. Monseñor Rivero 123, Santa Cruz de la Sierra",
      },
      notes: {
        type: "string",
        nullable: true,
        example: "Entregar en horario de la mañana",
      },
      created_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-02T14:30:00.000Z",
      },
    },
  },
  OrderPicking: {
    type: "object",
    properties: {
      order: { $ref: "#/components/schemas/PickingOrderHeader" },
      customer: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/OrderCustomerSummary" }],
      },
      summary: { $ref: "#/components/schemas/PickingSummary" },
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/PickingItem" },
      },
    },
  },
};

module.exports = pickingSchemas;
