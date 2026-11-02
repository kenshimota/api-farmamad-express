const INVOICE_ITEM = {
  type: "object",
  properties: {
    order_item_id: {
      type: "integer",
      nullable: true,
      description:
        "Order line id; null while HU-34/#58 (order_items) is not available",
      example: 20,
    },
    product_id: { type: "integer", example: 15 },
    product_name: { type: "string", example: "Ibuprofeno 400 mg" },
    product_reference: { type: "string", example: "IBU-400" },
    item_state_id: { type: "integer", example: 1 },
    item_state_name: { type: "string", example: "sellable" },
    quantity: { type: "integer", minimum: 1, example: 2 },
    unit_price: { type: "number", example: 12.5 },
    subtotal: { type: "number", example: 25.0 },
  },
};

const INVOICE_BASE = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    number: {
      type: "integer",
      description: "Assigned by invoices_number_seq",
      example: 1,
    },
    order_id: {
      type: "integer",
      nullable: true,
      description: "Null until the orders module (HU-34/#58, HU-39/#63) exists",
      example: 10,
    },
    order_number: {
      type: "integer",
      nullable: true,
      description: "Order number when the order relation is available",
      example: 1,
    },
    customer_id: { type: "integer", example: 8 },
    customer: {
      type: "object",
      description: "Nested customer with the documented public fields",
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
    currency_id: { type: "integer", example: 3 },
    currency: { $ref: "#/components/schemas/CurrencySummary" },
    payment_term_id: {
      type: "integer",
      description: "Immutable payment term snapshot copied from the order",
      example: 3,
    },
    payment_term: {
      nullable: true,
      allOf: [{ $ref: "#/components/schemas/PaymentTermSummary" }],
    },
    subtotal: { type: "number", example: 25.0 },
    tax_amount: {
      type: "number",
      description: "Always 0 in this HU (no fiscal invoicing)",
      example: 0,
    },
    total: { type: "number", example: 25.0 },
    paid_amount: {
      type: "number",
      description: "Maintained by the future payments module (HU-43)",
      example: 0,
    },
    balance_due: {
      type: "number",
      description: "total - paid_amount",
      example: 25.0,
    },
    payment_status: {
      type: "string",
      enum: ["pending", "partial", "paid"],
      example: "pending",
    },
    issued_at: {
      type: "string",
      format: "date-time",
      example: "2026-11-01T12:00:00.000Z",
    },
    due_date: {
      type: "string",
      format: "date",
      description: "issued_at date + payment_terms.days (cash = issue date)",
      example: "2026-11-16",
    },
    notes: { type: "string", nullable: true, example: "Factura del pedido 1" },
  },
};

const invoiceSchemas = {
  Invoice: {
    ...INVOICE_BASE,
    description: "Invoice summary without lines or internal user",
  },
  InvoiceDetail: {
    type: "object",
    description:
      "Invoice detail with its immutable snapshot lines; invoiced_by is only exposed to admin and seller",
    properties: {
      ...INVOICE_BASE.properties,
      invoiced_by: {
        type: "object",
        description: "Only present for admin and seller responses",
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "admin" },
          email: { type: "string", example: "admin@example.com" },
        },
      },
      items: {
        type: "array",
        items: INVOICE_ITEM,
      },
    },
  },
};

module.exports = invoiceSchemas;
