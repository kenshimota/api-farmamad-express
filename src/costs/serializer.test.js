const {
  toCostNumber,
  toPublicCost,
  toPublicCostItemState,
} = require("./serializer");

const CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
};

describe("toCostNumber", () => {
  it.each([
    ["12.50", 12.5],
    ["20.00", 20],
    [12.5, 12.5],
    [0, 0],
    ["0.00", 0],
  ])("serializes %p as the number %p", (value, expected) => {
    expect(toCostNumber(value)).toBe(expected);
  });

  it.each([null, undefined, "abc", NaN, Infinity])(
    "returns null for %p",
    (value) => {
      expect(toCostNumber(value)).toBeNull();
    },
  );

  it("rounds to two decimals", () => {
    expect(toCostNumber("12.345")).toBe(12.35);
    expect(toCostNumber("12.344")).toBe(12.34);
  });
});

describe("toPublicCostItemState", () => {
  it("exposes only id, name, label and is_sellable", () => {
    expect(
      toPublicCostItemState({
        id: 2,
        name: "damaged",
        label: "Maltratado",
        description: "No usar",
        is_sellable: false,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ).toEqual({
      id: 2,
      name: "damaged",
      label: "Maltratado",
      is_sellable: false,
    });
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      id: 7,
      name: "expired",
      label: "Vencido",
      is_sellable: false,
    };
    const itemState = {
      get: jest.fn((field) => values[field]),
      id: 999,
      name: "Wrong",
    };

    expect(toPublicCostItemState(itemState)).toEqual(values);
    expect(itemState.get).toHaveBeenCalledWith("id");
  });
});

describe("toPublicCost", () => {
  it("serializes a plain cost with its nested item state", () => {
    const cost = {
      id: 1,
      product_id: 15,
      item_state_id: 2,
      cost: "12.50",
      currency_id: 3,
      currency: CURRENCY,
      item_state: {
        id: 2,
        name: "damaged",
        label: "Maltratado",
        is_sellable: false,
      },
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(toPublicCost(cost)).toEqual({
      id: 1,
      product_id: 15,
      item_state_id: 2,
      cost: 12.5,
      currency_id: 3,
      currency: CURRENCY,
      item_state: {
        id: 2,
        name: "damaged",
        label: "Maltratado",
        is_sellable: false,
      },
    });
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const values = {
      id: 3,
      product_id: 4,
      item_state_id: 5,
      cost: "20.00",
      currency_id: 3,
      currency: CURRENCY,
      item_state: {
        id: 5,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    };
    const cost = { get: jest.fn((field) => values[field]) };

    expect(toPublicCost(cost)).toEqual({
      id: 3,
      product_id: 4,
      item_state_id: 5,
      cost: 20,
      currency_id: 3,
      currency: CURRENCY,
      item_state: {
        id: 5,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    });
  });

  it("uses the item state passed as the second argument", () => {
    const itemState = {
      id: 1,
      name: "sellable",
      label: "Vendible",
      is_sellable: true,
    };

    expect(
      toPublicCost(
        { id: 1, product_id: 2, item_state_id: 1, cost: 9.99 },
        itemState,
      ).item_state,
    ).toEqual(itemState);
  });

  it("exposes only the documented fields in order", () => {
    const cost = {
      id: 1,
      product_id: 2,
      item_state_id: 3,
      cost: 1,
      item_state: {
        id: 3,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicCost(cost))).toEqual([
      "id",
      "product_id",
      "item_state_id",
      "cost",
      "currency_id",
      "currency",
      "item_state",
    ]);
  });

  it("returns a null item state when the association was not loaded", () => {
    expect(
      toPublicCost({ id: 1, product_id: 2, item_state_id: 3, cost: 1 }),
    ).toEqual({
      id: 1,
      product_id: 2,
      item_state_id: 3,
      cost: 1,
      currency_id: null,
      currency: null,
      item_state: null,
    });
  });
});
