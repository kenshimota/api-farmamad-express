const ORDER_STATUSES = [
  "draft",
  "request",
  "generate",
  "invoiced",
  "cancelled",
];

const orderSchemas = {
  OrderItemInput: {
    type: "object",
    required: ["product_id", "item_state_id", "quantity"],
    properties: {
      product_id: { type: "integer", minimum: 1, example: 15 },
      item_state_id: { type: "integer", minimum: 1, example: 1 },
      quantity: {
        type: "integer",
        minimum: 1,
        maximum: 999,
        example: 2,
      },
    },
  },
  OrderProductSummary: {
    type: "object",
    properties: {
      id: { type: "integer", example: 15 },
      name: { type: "string", example: "Ibuprofeno 400 mg" },
      reference: { type: "string", example: "IBU-400" },
      image_id: { type: "integer", example: 7 },
    },
  },
  OrderItemStateSummary: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "sellable" },
      label: { type: "string", example: "Vendible" },
    },
  },
  OrderItem: {
    type: "object",
    properties: {
      id: { type: "integer", example: 20 },
      product_id: { type: "integer", example: 15 },
      item_state_id: { type: "integer", example: 1 },
      item_state: { $ref: "#/components/schemas/OrderItemStateSummary" },
      quantity: { type: "integer", minimum: 1, example: 2 },
      unit_price: {
        type: "number",
        description: "Snapshot in the order currency",
        example: 12.5,
      },
      subtotal: {
        type: "number",
        description: "quantity × unit_price (pre-tax)",
        example: 25.0,
      },
      tax_id: { type: "integer", nullable: true, example: 2 },
      tax_code: { type: "string", nullable: true, example: "IVA" },
      tax_name: {
        type: "string",
        nullable: true,
        example: "Impuesto al Valor Agregado",
      },
      tax_rate: {
        type: "number",
        description: "Snapshot percentage, 16 means 16 %",
        example: 16,
      },
      tax_amount: {
        type: "number",
        description: "subtotal × tax_rate ÷ 100",
        example: 4.0,
      },
      total: {
        type: "number",
        description: "subtotal + tax_amount",
        example: 29.0,
      },
      product: { $ref: "#/components/schemas/OrderProductSummary" },
    },
  },
  OrderHistoryEvent: {
    type: "object",
    properties: {
      event_type: {
        type: "string",
        enum: [
          "created",
          "item_added",
          "item_updated",
          "item_removed",
          "status_changed",
          "invoice_issued",
        ],
        example: "created",
      },
      from_status: { type: "string", nullable: true, example: null },
      to_status: { type: "string", nullable: true, example: "draft" },
      metadata: {
        type: "object",
        nullable: true,
        example: null,
      },
      created_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-01T10:00:00.000Z",
      },
      actor: {
        type: "object",
        nullable: true,
        description: "Internal roles only",
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "admin" },
          email: { type: "string", example: "admin@farmamad.com" },
        },
      },
    },
  },
  OrderCustomerSummary: {
    type: "object",
    properties: {
      id: { type: "integer", example: 8 },
      fullName: { type: "string", example: "Cliente Demo" },
      email: {
        type: "string",
        format: "email",
        example: "cliente@example.com",
      },
      direction: { type: "string", example: "Av. Monseñor Rivero 123" },
    },
  },
  OrderSummary: {
    type: "object",
    properties: {
      id: { type: "integer", example: 10 },
      number: { type: "integer", example: 1 },
      status: { type: "string", enum: ORDER_STATUSES, example: "draft" },
      customer_id: { type: "integer", example: 8 },
      user_id: { type: "integer", example: 12 },
      currency_id: { type: "integer", example: 3 },
      currency: { $ref: "#/components/schemas/CurrencySummary" },
      payment_term_id: { type: "integer", nullable: true, example: 2 },
      payment_term: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PaymentTermSummary" }],
      },
      subtotal: {
        type: "number",
        description: "Pre-tax subtotal",
        example: 25.0,
      },
      tax_amount: {
        type: "number",
        description: "Sum of line taxes",
        example: 4.0,
      },
      total: {
        type: "number",
        description: "subtotal + tax_amount",
        example: 29.0,
      },
      delivery_address: {
        type: "string",
        example: "Av. Monseñor Rivero 123",
      },
      notes: {
        type: "string",
        nullable: true,
        example: "Entregar por la tarde",
      },
      created_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-01T10:00:00.000Z",
      },
      customer: { $ref: "#/components/schemas/OrderCustomerSummary" },
      items_count: { type: "integer", minimum: 0, example: 2 },
    },
  },
  OrderDetail: {
    type: "object",
    properties: {
      id: { type: "integer", example: 10 },
      number: { type: "integer", example: 1 },
      status: { type: "string", enum: ORDER_STATUSES, example: "draft" },
      customer_id: { type: "integer", example: 8 },
      user_id: { type: "integer", example: 12 },
      currency_id: { type: "integer", example: 3 },
      currency: { $ref: "#/components/schemas/CurrencySummary" },
      payment_term_id: { type: "integer", nullable: true, example: 2 },
      payment_term: {
        nullable: true,
        allOf: [{ $ref: "#/components/schemas/PaymentTermSummary" }],
      },
      subtotal: {
        type: "number",
        description: "Pre-tax subtotal",
        example: 25.0,
      },
      tax_amount: {
        type: "number",
        description: "Sum of line taxes",
        example: 4.0,
      },
      total: {
        type: "number",
        description: "subtotal + tax_amount",
        example: 29.0,
      },
      delivery_address: {
        type: "string",
        example: "Av. Monseñor Rivero 123",
      },
      notes: {
        type: "string",
        nullable: true,
        example: "Entregar por la tarde",
      },
      created_at: {
        type: "string",
        format: "date-time",
        example: "2026-11-01T10:00:00.000Z",
      },
      customer: { $ref: "#/components/schemas/OrderCustomerSummary" },
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/OrderItem" },
      },
      history: {
        type: "array",
        items: { $ref: "#/components/schemas/OrderHistoryEvent" },
      },
    },
  },
  InsufficientStockError: {
    type: "object",
    properties: {
      message: { type: "string", example: "Insufficient stock" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            product_id: { type: "integer", example: 15 },
            item_state_id: { type: "integer", example: 1 },
          },
        },
      },
    },
  },
};

module.exports = orderSchemas;
