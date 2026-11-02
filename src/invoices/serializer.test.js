const { toPublicInvoice, toPublicInvoiceItem } = require("./serializer");

const CUSTOMER = {
  id: 8,
  fullName: "Cliente Demo",
  email: "cliente@example.com",
  direction: "Av. Monseñor Rivero 123",
  latitude: -17.78,
  longitude: -63.18,
};
const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
  rate: "1000.50",
};
const PAYMENT_TERM = {
  id: 3,
  code: "credit_15",
  name: "Crédito 15 días",
  days: 15,
  description: "Quince días",
};
const USER = { id: 1, username: "admin", email: "admin@example.com" };
const ITEM = {
  id: 4,
  invoice_id: 1,
  order_item_id: 20,
  product_id: 15,
  product_name: "Ibuprofeno 400 mg",
  product_reference: "IBU-400",
  item_state_id: 1,
  item_state_name: "sellable",
  quantity: 2,
  unit_price: "12.50",
  subtotal: "25.00",
  createdAt: new Date("2026-11-01T12:00:00.000Z"),
};
const INVOICE = {
  id: 1,
  number: 1,
  order_id: 10,
  order: { id: 10, number: 1 },
  customer_id: 8,
  customer: CUSTOMER,
  invoiced_by_user_id: 1,
  invoiced_by: USER,
  currency_id: 3,
  currency: CURRENCY,
  payment_term_id: 3,
  payment_term: PAYMENT_TERM,
  subtotal: "25.00",
  tax_amount: "0.00",
  total: "25.00",
  paid_amount: "25.00",
  payment_status: "paid",
  issued_at: new Date("2026-11-01T12:00:00.000Z"),
  due_date: "2026-11-16",
  notes: "Factura generada desde el pedido 1",
  items: [ITEM],
  createdAt: new Date("2026-11-01T12:00:00.000Z"),
  updatedAt: new Date("2026-11-01T12:00:00.000Z"),
};

describe("toPublicInvoiceItem", () => {
  it("exposes the line snapshot with numeric amounts", () => {
    expect(toPublicInvoiceItem(ITEM)).toEqual({
      order_item_id: 20,
      product_id: 15,
      product_name: "Ibuprofeno 400 mg",
      product_reference: "IBU-400",
      item_state_id: 1,
      item_state_name: "sellable",
      quantity: 2,
      unit_price: 12.5,
      subtotal: 25,
    });
  });

  it("does not expose ids, costs, lots or audit columns", () => {
    const result = toPublicInvoiceItem({
      ...ITEM,
      id: 4,
      cost: "1.00",
      lot_id: 2,
    });

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("cost");
    expect(result).not.toHaveProperty("lot_id");
    expect(result).not.toHaveProperty("createdAt");
  });
});

describe("toPublicInvoice", () => {
  it("returns a summary without items or internal user", () => {
    const result = toPublicInvoice(INVOICE);

    expect(result).toMatchObject({
      id: 1,
      number: 1,
      order_id: 10,
      order_number: 1,
      customer_id: 8,
      customer: {
        id: 8,
        fullName: "Cliente Demo",
        email: "cliente@example.com",
        direction: "Av. Monseñor Rivero 123",
      },
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      payment_term_id: 3,
      payment_term: {
        id: 3,
        code: "credit_15",
        name: "Crédito 15 días",
        days: 15,
      },
      subtotal: 25,
      tax_amount: 0,
      total: 25,
      paid_amount: 25,
      balance_due: 0,
      payment_status: "paid",
      issued_at: "2026-11-01T12:00:00.000Z",
      due_date: "2026-11-16",
      notes: "Factura generada desde el pedido 1",
    });
    expect(result).not.toHaveProperty("items");
    expect(result).not.toHaveProperty("invoiced_by");
    expect(result).not.toHaveProperty("createdAt");
  });

  it("includes items and invoiced_by on demand", () => {
    const result = toPublicInvoice(INVOICE, {
      includeItems: true,
      includeInvoicedBy: true,
    });

    expect(result.invoiced_by).toEqual(USER);
    expect(result.items).toEqual([toPublicInvoiceItem(ITEM)]);
  });

  it("keeps customer relations out of the customer object", () => {
    const result = toPublicInvoice(INVOICE);

    expect(result.customer).not.toHaveProperty("latitude");
    expect(result.customer).not.toHaveProperty("longitude");
    expect(result.currency).not.toHaveProperty("rate");
  });

  it("calculates balance_due and handles invalid monetary values", () => {
    expect(
      toPublicInvoice({ ...INVOICE, total: "25.00", paid_amount: "10.00" })
        .balance_due,
    ).toBe(15);
    expect(
      toPublicInvoice({ ...INVOICE, total: null, paid_amount: "10.00" })
        .balance_due,
    ).toBeNull();
    expect(
      toPublicInvoice({ ...INVOICE, total: "abc", paid_amount: null })
        .balance_due,
    ).toBeNull();
  });

  it("serializes due_date from a Date and tolerates missing relations", () => {
    const result = toPublicInvoice({
      ...INVOICE,
      customer: null,
      currency: null,
      payment_term: null,
      order: null,
      due_date: new Date("2026-11-16T00:00:00.000Z"),
      issued_at: "2026-11-01T12:00:00.000Z",
    });

    expect(result.due_date).toBe("2026-11-16");
    expect(result.order_number).toBeNull();
    expect(result.issued_at).toBe("2026-11-01T12:00:00.000Z");
    expect(result).not.toHaveProperty("customer");
    expect(result).not.toHaveProperty("payment_term");
  });

  it("exposes null issued_at and due_date when they are absent", () => {
    const result = toPublicInvoice({
      ...INVOICE,
      issued_at: null,
      due_date: null,
    });

    expect(result.issued_at).toBeNull();
    expect(result.due_date).toBeNull();
  });

  it("adds the summarized payment history on demand", () => {
    const result = toPublicInvoice(
      {
        ...INVOICE,
        paid_amount: "10.00",
        payment_status: "partial",
        payment_allocations: [
          {
            payment_id: 5,
            amount: "10.00",
            applied_amount: "10.00",
            allocated_at: new Date("2026-11-01T13:00:00.000Z"),
            payment: {
              currency: {
                id: 2,
                code: "USDT",
                name: "Tether",
                symbol: "$",
              },
            },
          },
        ],
      },
      { includePaymentHistory: true },
    );

    expect(result).toMatchObject({
      paid_amount: 10,
      balance_due: 15,
      payment_status: "partial",
      payments_count: 1,
      payment_history: [
        {
          payment_id: 5,
          amount: 10,
          currency: {
            id: 2,
            code: "USDT",
            name: "Tether",
            symbol: "$",
          },
          applied_amount: 10,
          allocated_at: "2026-11-01T13:00:00.000Z",
        },
      ],
    });
    expect(result.payment_history[0]).not.toHaveProperty("created_by");
  });

  it("returns an empty payment history when there are no allocations", () => {
    const result = toPublicInvoice(
      { ...INVOICE, payment_allocations: [] },
      { includePaymentHistory: true },
    );

    expect(result.payments_count).toBe(0);
    expect(result.payment_history).toEqual([]);
  });
});
