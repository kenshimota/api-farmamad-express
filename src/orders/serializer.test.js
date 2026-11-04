const { toPublicOrder, toPublicOrderItem } = require("./serializer");

describe("orders serializer", () => {
  it("serializes decimals, dates and nested summaries", () => {
    const order = {
      id: 10,
      number: 1,
      status: "draft",
      customer_id: 8,
      user_id: 12,
      currency_id: 3,
      subtotal: "25.00",
      tax_amount: "4.00",
      total: "29.00",
      delivery_address: "Av. Monseñor Rivero 123",
      notes: "Entregar por la tarde",
      createdAt: new Date("2026-10-30T15:00:00.000Z"),
      currency: { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
      customer: {
        id: 8,
        fullName: "Cliente Demo",
        email: "cliente@example.com",
        direction: "Av. Monseñor Rivero 123",
      },
      items: [
        {
          id: 20,
          product_id: 15,
          item_state_id: 1,
          quantity: 2,
          unit_price: "12.50",
          subtotal: "25.00",
          tax_id: 2,
          tax_code: "IVA",
          tax_name: "Impuesto al Valor Agregado",
          tax_rate: "16.00",
          tax_amount: "4.00",
          total: "29.00",
          item_state: { id: 1, name: "sellable", label: "Vendible" },
          product: {
            id: 15,
            name: "Ibuprofeno 400 mg",
            reference: "IBU-400",
            image_id: 7,
            description: "Analgésico",
          },
          allocations: [{ lot_id: 99, quantity: 2 }],
        },
      ],
      history: [
        {
          id: 1,
          event_type: "created",
          from_status: null,
          to_status: "draft",
          createdAt: new Date("2026-10-30T15:00:00.000Z"),
          actor_user_id: 12,
        },
      ],
    };

    expect(
      toPublicOrder(order, { includeItems: true, includeHistory: true }),
    ).toEqual({
      id: 10,
      number: 1,
      status: "draft",
      customer_id: 8,
      user_id: 12,
      currency_id: 3,
      currency: { id: 3, code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
      subtotal: 25,
      tax_amount: 4,
      total: 29,
      delivery_address: "Av. Monseñor Rivero 123",
      notes: "Entregar por la tarde",
      created_at: "2026-10-30T15:00:00.000Z",
      customer: {
        id: 8,
        fullName: "Cliente Demo",
        email: "cliente@example.com",
        direction: "Av. Monseñor Rivero 123",
      },
      items: [
        {
          id: 20,
          product_id: 15,
          item_state_id: 1,
          item_state: { id: 1, name: "sellable", label: "Vendible" },
          quantity: 2,
          unit_price: 12.5,
          subtotal: 25,
          tax_id: 2,
          tax_code: "IVA",
          tax_name: "Impuesto al Valor Agregado",
          tax_rate: 16,
          tax_amount: 4,
          total: 29,
          product: {
            id: 15,
            name: "Ibuprofeno 400 mg",
            reference: "IBU-400",
            image_id: 7,
          },
        },
      ],
      history: [
        {
          event_type: "created",
          from_status: null,
          to_status: "draft",
          metadata: null,
          created_at: "2026-10-30T15:00:00.000Z",
        },
      ],
    });
  });

  it("never exposes internal lot, cost, warehouse or allocation fields", () => {
    const item = toPublicOrderItem({
      id: 20,
      product_id: 15,
      item_state_id: 1,
      quantity: 1,
      unit_price: "10.00",
      subtotal: "10.00",
      cost: "5.00",
      lot_id: 99,
      allocations: [{ lot_id: 99 }],
      product: { id: 15, name: "P", reference: "R", image_id: 1 },
      item_state: { id: 1, name: "sellable", label: "Vendible" },
    });

    expect(item).not.toHaveProperty("cost");
    expect(item).not.toHaveProperty("lot_id");
    expect(item).not.toHaveProperty("allocations");
  });
});

describe("order payment term snapshot", () => {
  it("exposes the id and the compact term when loaded", () => {
    const result = toPublicOrder({
      id: 10,
      payment_term_id: 3,
      payment_term: {
        id: 3,
        code: "credit_15",
        name: "Crédito 15 días",
        days: 15,
        is_active: true,
      },
    });

    expect(result.payment_term_id).toBe(3);
    expect(result.payment_term).toEqual({
      id: 3,
      code: "credit_15",
      name: "Crédito 15 días",
      days: 15,
    });
  });

  it("exposes a null id and no nested term for a draft without term", () => {
    const result = toPublicOrder({ id: 10, payment_term_id: null });

    expect(result.payment_term_id).toBeNull();
    expect(result).not.toHaveProperty("payment_term");
  });
});
