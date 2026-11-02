const {
  REQUIRED_INVOICE_FIELDS,
  REQUIRED_INVOICE_ITEM_FIELDS,
  createInvoiceItemSchema,
  createInvoiceSchema,
} = require("./validators");

function validate(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

const VALID_ITEM = {
  order_item_id: 20,
  product_id: 15,
  product_name: "Ibuprofeno 400 mg",
  product_reference: "IBU-400",
  item_state_id: 1,
  item_state_name: "sellable",
  quantity: 2,
  unit_price: 12.5,
  subtotal: 25,
};

const VALID_INVOICE = {
  order_id: 10,
  customer_id: 8,
  invoiced_by_user_id: 1,
  currency_id: 3,
  payment_term_id: 3,
  payment_term_days: 15,
  subtotal: 25,
  total: 25,
  notes: "  Factura  ",
  items: [VALID_ITEM],
};

describe("invoice validators", () => {
  it("exposes the required fields", () => {
    expect(REQUIRED_INVOICE_FIELDS).toEqual([
      "customer_id",
      "invoiced_by_user_id",
      "currency_id",
      "subtotal",
      "total",
    ]);
    expect(REQUIRED_INVOICE_ITEM_FIELDS).toEqual([
      "product_id",
      "product_name",
      "product_reference",
      "item_state_id",
      "item_state_name",
      "quantity",
      "unit_price",
    ]);
  });

  it("accepts a full invoice and strips unknown fields", () => {
    return expect(
      validate(createInvoiceSchema, {
        ...VALID_INVOICE,
        number: 99,
        status: "paid",
        tax_amount: 0,
        paid_amount: 0,
        payment_status: "pending",
        items: [{ ...VALID_ITEM, cost: 1, lot_id: 2 }],
      }),
    ).resolves.toEqual({
      order_id: 10,
      customer_id: 8,
      invoiced_by_user_id: 1,
      currency_id: 3,
      payment_term_id: 3,
      payment_term_days: 15,
      subtotal: 25,
      total: 25,
      notes: "Factura",
      tax_amount: 0,
      paid_amount: 0,
      payment_status: "pending",
      items: [VALID_ITEM],
    });
  });

  it("defaults the optional fields", async () => {
    const { items, ...withoutItems } = VALID_INVOICE;

    await expect(validate(createInvoiceSchema, withoutItems)).resolves.toEqual(
      expect.objectContaining({
        tax_amount: 0,
        paid_amount: 0,
        payment_status: "pending",
        items: [],
      }),
    );
  });

  it.each([
    [{ customer_id: 0 }, "customer_id"],
    [{ invoiced_by_user_id: 0 }, "invoiced_by_user_id"],
    [{ currency_id: "abc" }, "currency_id"],
    [{ order_id: -1 }, "order_id"],
    [{ payment_term_id: 0 }, "payment_term_id"],
    [{ payment_term_days: -1 }, "payment_term_days"],
    [{ subtotal: -1 }, "subtotal"],
    [{ subtotal: 1.234 }, "subtotal"],
    [{ total: -1 }, "total"],
    [{ tax_amount: -1 }, "tax_amount"],
    [{ paid_amount: -1 }, "paid_amount"],
    [{ payment_status: "cancelled" }, "payment_status"],
    [{ notes: "x".repeat(1001) }, "notes"],
    [{ items: {} }, "items"],
  ])("rejects the invalid invoice %p", async (overrides) => {
    await expect(
      validate(createInvoiceSchema, { ...VALID_INVOICE, ...overrides }),
    ).rejects.toThrow();
  });

  it("accepts blank notes as null", async () => {
    const result = await validate(createInvoiceSchema, {
      ...VALID_INVOICE,
      notes: "   ",
    });

    expect(result.notes).toBeNull();
  });

  it.each([
    [{ product_id: 0 }, "product_id"],
    [{ product_name: "" }, "product_name"],
    [{ product_name: "x".repeat(151) }, "product_name"],
    [{ product_reference: "" }, "product_reference"],
    [{ product_reference: "x".repeat(101) }, "product_reference"],
    [{ item_state_id: 0 }, "item_state_id"],
    [{ item_state_name: "" }, "item_state_name"],
    [{ item_state_name: "x".repeat(51) }, "item_state_name"],
    [{ quantity: 0 }, "quantity"],
    [{ quantity: 1.5 }, "quantity"],
    [{ unit_price: -1 }, "unit_price"],
    [{ unit_price: 1.234 }, "unit_price"],
    [{ subtotal: -1 }, "subtotal"],
    [{ order_item_id: 0 }, "order_item_id"],
  ])("rejects the invalid line %p", async (overrides) => {
    await expect(
      validate(createInvoiceItemSchema, { ...VALID_ITEM, ...overrides }),
    ).rejects.toThrow();
  });

  it("accepts an absent order_item_id because order_items is not available", async () => {
    const { order_item_id, ...withoutOrderItem } = VALID_ITEM;

    await expect(
      validate(createInvoiceItemSchema, withoutOrderItem),
    ).resolves.toEqual(withoutOrderItem);
  });
});
