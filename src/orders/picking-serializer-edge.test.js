const { simplePickingOrder } = require("../../test/helpers/picking");
const { toPickingResponse } = require("./picking-serializer");

describe("picking serializer edge branches", () => {
  it("covers missing dates, quantities, relations and FEFO id ties", () => {
    const result = toPickingResponse({
      id: 14,
      number: 14,
      status: "generate",
      customer_id: 8,
      delivery_address: "Dirección",
      notes: null,
      customer: null,
      items: [
        {
          id: 28,
          product_id: 15,
          item_state_id: 1,
          quantity: "bad",
          allocations: [
            {
              id: 45,
              quantity: "bad",
              status: "released",
              lot: null,
            },
            {
              id: 44,
              quantity: 1,
              status: "reserved",
              lot: {
                id: 61,
                number: "LOTE-B",
                expiration_date: "2027-05-01",
                location_status: "located",
                stock: "bad",
                reserved: null,
              },
            },
            {
              id: 43,
              quantity: 1,
              status: "reserved",
              lot: {
                id: 60,
                number: "LOTE-A",
                expiration_date: 123,
                location_status: "located",
                stock: 1,
                reserved: 0,
              },
            },
          ],
        },
        {
          id: 29,
          product_id: 15,
          item_state_id: 1,
          quantity: 3,
          allocations: null,
        },
      ],
    });

    expect(result.order.created_at).toBeNull();
    expect(result.customer).toBeNull();
    expect(result.items[0].quantity).toBe(0);
    expect(
      result.items[0].lots.map((allocation) => allocation.allocation_id),
    ).toEqual([45, 43, 44]);
    expect(result.items[0].lots[0].lot).toBeNull();
    expect(result.items[0].lots[1].lot.expiration_date).toBeNull();
    expect(result.items[0].lots[1].lot).toMatchObject({
      id: 60,
      stock: 1,
      reserved: 0,
      available: 1,
    });
    expect(result.items[0].lots[2].lot).toMatchObject({
      id: 61,
      expiration_date: "2027-05-01",
      stock: 0,
      reserved: 0,
      available: 0,
    });
    expect(result.items[1]).toMatchObject({
      order_item_id: 29,
      quantity: 3,
      allocated_quantity: 0,
      pending_quantity: 3,
      product: null,
      item_state: null,
      lots: [],
    });
  });

  it("keeps string timestamps and defaults the location status", () => {
    const result = toPickingResponse(
      simplePickingOrder({
        createdAt: "2026-11-02T16:00:00.000Z",
        items: [
          {
            id: 30,
            product_id: 15,
            item_state_id: 1,
            quantity: 1,
            product: {
              id: 15,
              name: "Producto",
              reference: "P-1",
              image_id: 1,
            },
            item_state: { id: 1, name: "sellable", label: "Vendible" },
            allocations: [
              {
                id: 50,
                quantity: 1,
                status: "reserved",
                lot: {
                  id: 70,
                  number: "LOTE-Z",
                  expiration_date: "2027-01-01",
                  stock: 2,
                  reserved: 1,
                  warehouse: { id: 1, name: "Bodega" },
                  shelf: { id: 1, code: "S1", name: null },
                  section: { id: 1, code: "C1", name: null },
                },
              },
            ],
          },
          {
            id: 31,
            product_id: 16,
            item_state_id: 1,
            quantity: 2,
            allocations: [],
          },
        ],
      }),
    );

    expect(result.order.created_at).toBe("2026-11-02T16:00:00.000Z");
    expect(result.items[0].lots[0].lot).toMatchObject({
      location_status: "located",
      available: 1,
      shelf: { id: 1, code: "S1", name: null },
      section: { id: 1, code: "C1", name: null },
    });
  });

  it("returns an empty view when items is not an array", () => {
    const result = toPickingResponse(simplePickingOrder({ items: undefined }));

    expect(result.items).toEqual([]);
    expect(result.summary).toEqual({
      lines_count: 0,
      lots_count: 0,
      ordered_units: 0,
      allocated_units: 0,
      pending_units: 0,
      ready: false,
    });
  });
});
