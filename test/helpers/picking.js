/**
 * Builds an order snapshot with items and allocations intentionally unsorted
 * to prove the serializer applies the deterministic order.
 * @returns {object} Order snapshot.
 */
function pickingOrder() {
  return {
    id: 10,
    number: 10,
    status: "generate",
    customer_id: 8,
    delivery_address: "Av. Monseñor Rivero 123",
    notes: "Entregar en horario de la mañana",
    createdAt: new Date("2026-11-02T14:30:00.000Z"),
    customer: {
      id: 8,
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Av. Monseñor Rivero 123",
    },
    items: [
      {
        id: 21,
        product_id: 22,
        item_state_id: 1,
        quantity: 20,
        product: {
          id: 22,
          name: "Paracetamol 500 mg",
          reference: "PAR-500",
          image_id: 8,
        },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
        allocations: [
          {
            id: 33,
            quantity: 20,
            status: "reserved",
            lot: {
              id: 42,
              number: "LOTE-9",
              expiration_date: "2027-09-30",
              location_status: "located",
              stock: 60,
              reserved: 20,
              warehouse: { id: 2, name: "Bodega Norte" },
              shelf: { id: 7, code: "B1", name: "Estante B1" },
              section: { id: 9, code: "B1-02", name: "Nivel 2" },
            },
          },
        ],
      },
      {
        id: 20,
        product_id: 15,
        item_state_id: 1,
        quantity: 10,
        product: {
          id: 15,
          name: "Ibuprofeno 400 mg",
          reference: "IBU-400",
          image_id: 4,
        },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
        allocations: [
          {
            id: 32,
            quantity: 4,
            status: "reserved",
            lot: {
              id: 41,
              number: "LOTE-2",
              expiration_date: "2027-06-30",
              location_status: "located",
              stock: 200,
              reserved: 4,
              warehouse: { id: 1, name: "Bodega Central" },
              shelf: { id: 3, code: "A2", name: "Estante A2" },
              section: { id: 5, code: "A2-01", name: "Nivel 1" },
            },
          },
          {
            id: 31,
            quantity: 6,
            status: "reserved",
            lot: {
              id: 40,
              number: "LOTE-1",
              expiration_date: new Date("2027-03-31T00:00:00.000Z"),
              location_status: "located",
              stock: 100,
              reserved: 20,
              warehouse: { id: 1, name: "Bodega Central" },
              shelf: { id: 2, code: "A1", name: "Estante A1" },
              section: { id: 3, code: "A1-03", name: "Nivel 3" },
            },
          },
        ],
      },
    ],
  };
}

/**
 * Builds a minimal order snapshot with one line.
 * @param {object} [overrides] - Order, customer or line overrides.
 * @returns {object} Order snapshot.
 */
function simplePickingOrder(overrides = {}) {
  const order = {
    id: 11,
    number: 11,
    status: "request",
    customer_id: 8,
    delivery_address: "Av. Monseñor Rivero 123",
    notes: null,
    createdAt: new Date("2026-11-02T16:00:00.000Z"),
    customer: {
      id: 8,
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Av. Monseñor Rivero 123",
    },
    items: [
      {
        id: 25,
        product_id: 15,
        item_state_id: 1,
        quantity: 5,
        product: {
          id: 15,
          name: "Ibuprofeno 400 mg",
          reference: "IBU-400",
          image_id: 4,
        },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
        allocations: [],
      },
    ],
  };

  return { ...order, ...overrides };
}

module.exports = { pickingOrder, simplePickingOrder };
