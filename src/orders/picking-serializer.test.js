const {
  pickingOrder,
  simplePickingOrder,
} = require("../../test/helpers/picking");
const { toPickingResponse } = require("./picking-serializer");

describe("picking serializer", () => {
  it("serializes lots with their current location and available stock", () => {
    const result = toPickingResponse(pickingOrder());
    const firstLot = result.items[0].lots[0];

    expect(firstLot).toEqual({
      allocation_id: 31,
      quantity: 6,
      status: "reserved",
      lot: {
        id: 40,
        number: "LOTE-1",
        expiration_date: "2027-03-31",
        location_status: "located",
        stock: 100,
        reserved: 20,
        available: 80,
        warehouse: { id: 1, name: "Bodega Central" },
        shelf: { id: 2, code: "A1", name: "Estante A1" },
        section: { id: 3, code: "A1-03", name: "Nivel 3" },
      },
    });
  });

  it("returns empty lots and all pending units when there are no allocations", () => {
    const result = toPickingResponse(simplePickingOrder());

    expect(result.items[0]).toMatchObject({
      order_item_id: 25,
      quantity: 5,
      allocated_quantity: 0,
      pending_quantity: 5,
      lots: [],
    });
    expect(result.summary).toEqual({
      lines_count: 1,
      lots_count: 0,
      ordered_units: 5,
      allocated_units: 0,
      pending_units: 5,
      ready: false,
    });
  });

  it("never returns a negative pending quantity and keeps ready false", () => {
    const result = toPickingResponse(
      simplePickingOrder({
        status: "generate",
        items: [
          {
            id: 26,
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
                id: 40,
                quantity: 2,
                status: "reserved",
                lot: {
                  id: 50,
                  number: "LOTE-X",
                  expiration_date: "2027-01-01",
                  location_status: "pending",
                  stock: 5,
                  reserved: 0,
                },
              },
            ],
          },
        ],
      }),
    );

    expect(result.items[0].pending_quantity).toBe(0);
    expect(result.items[0].allocated_quantity).toBe(2);
    expect(result.summary.pending_units).toBe(0);
    expect(result.summary.ready).toBe(false);
    expect(result.items[0].lots[0].lot).toMatchObject({
      available: 0,
      warehouse: null,
      shelf: null,
      section: null,
    });
  });

  it("keeps the three location blocks null when the lot is incomplete", () => {
    const result = toPickingResponse(
      simplePickingOrder({
        status: "generate",
        items: [
          {
            id: 27,
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
                id: 41,
                quantity: 1,
                status: "reserved",
                lot: {
                  id: 51,
                  number: "LOTE-Y",
                  expiration_date: "2027-01-01",
                  location_status: "located",
                  stock: 5,
                  reserved: 0,
                  warehouse: { id: 1, name: "Bodega" },
                  shelf: null,
                  section: { id: 2, code: "C", name: null },
                },
              },
            ],
          },
        ],
      }),
    );

    expect(result.items[0].lots[0].lot).toMatchObject({
      warehouse: null,
      shelf: null,
      section: null,
    });
  });
});
