const { planLotAllocations } = require("./reservation");

/**
 * Builds a lot-like object with numeric quantities.
 * @param {object} values - Lot attributes.
 * @returns {object} The lot double.
 */
function lot(values) {
  return { stock: 0, reserved: 0, ...values };
}

describe("planLotAllocations", () => {
  it("takes the oldest lots first following the received FEFO order", () => {
    const lots = [
      lot({ id: 1, expiration_date: "2026-01-31", stock: 2 }),
      lot({ id: 2, expiration_date: "2026-06-30", stock: 5 }),
    ];

    expect(planLotAllocations(lots, 4)).toEqual({
      allocations: [
        { lot: lots[0], quantity: 2 },
        { lot: lots[1], quantity: 2 },
      ],
      remaining: 0,
    });
  });

  it("subtracts the active reservations from each lot", () => {
    const lots = [
      lot({ id: 1, stock: 5, reserved: 4 }),
      lot({ id: 2, stock: 3, reserved: 0 }),
    ];

    expect(planLotAllocations(lots, 2)).toEqual({
      allocations: [
        { lot: lots[0], quantity: 1 },
        { lot: lots[1], quantity: 1 },
      ],
      remaining: 0,
    });
  });

  it("reports the missing units when the lots do not reach the quantity", () => {
    const lots = [lot({ id: 1, stock: 2 }), lot({ id: 2, stock: 0 })];

    expect(planLotAllocations(lots, 5)).toEqual({
      allocations: [{ lot: lots[0], quantity: 2 }],
      remaining: 3,
    });
  });

  it("ignores lots without available units", () => {
    const lots = [lot({ id: 1, stock: 2, reserved: 2 })];

    expect(planLotAllocations(lots, 1)).toEqual({
      allocations: [],
      remaining: 1,
    });
  });
});
