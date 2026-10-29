const {
  toAvailableStock,
  toPublicStock,
  toPublicStockItemState,
} = require("./serializer");

const ITEM_STATE = {
  id: 2,
  name: "damaged",
  label: "Maltratado",
  is_sellable: false,
  description: "No usar",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};

describe("toPublicStockItemState", () => {
  it("exposes only id, name, label and is_sellable", () => {
    expect(toPublicStockItemState(ITEM_STATE)).toEqual({
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

    expect(toPublicStockItemState(itemState)).toEqual(values);
    expect(itemState.get).toHaveBeenCalledWith("id");
  });
});

describe("toPublicStock", () => {
  it("serializes the stock with its nested item state and without audits", () => {
    const stock = {
      id: 3,
      product_id: 15,
      item_state_id: 2,
      quantity: 40,
      item_state: ITEM_STATE,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(toPublicStock(stock)).toEqual({
      id: 3,
      product_id: 15,
      item_state_id: 2,
      quantity: 40,
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
      id: 1,
      product_id: 2,
      item_state_id: 3,
      quantity: 5,
      item_state: {
        id: 3,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    };
    const stock = { get: jest.fn((field) => values[field]) };

    expect(toPublicStock(stock)).toEqual(values);
  });

  it("returns a null item state when the association was not loaded", () => {
    expect(
      toPublicStock({ id: 1, product_id: 2, item_state_id: 3, quantity: 5 }),
    ).toEqual({
      id: 1,
      product_id: 2,
      item_state_id: 3,
      quantity: 5,
      item_state: null,
    });
  });
});

describe("toAvailableStock", () => {
  it("serializes the numeric cost and the nested item state", () => {
    const stock = {
      id: 3,
      product_id: 15,
      item_state_id: 2,
      quantity: 40,
      cost: { cost: "20.00" },
      item_state: ITEM_STATE,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(toAvailableStock(stock)).toEqual({
      product_id: 15,
      item_state_id: 2,
      quantity: 40,
      cost: 20,
      item_state: {
        id: 2,
        name: "damaged",
        label: "Maltratado",
        is_sellable: false,
      },
    });
  });

  it("keeps the row with a null cost when no cost exists", () => {
    const stock = {
      product_id: 15,
      item_state_id: 1,
      quantity: 4,
      cost: null,
      item_state: {
        id: 1,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    };

    expect(toAvailableStock(stock)).toEqual({
      product_id: 15,
      item_state_id: 1,
      quantity: 4,
      cost: null,
      item_state: {
        id: 1,
        name: "sellable",
        label: "Vendible",
        is_sellable: true,
      },
    });
  });

  it("returns null for an invalid or missing cost value", () => {
    expect(
      toAvailableStock({
        product_id: 15,
        item_state_id: 1,
        quantity: 1,
        cost: { cost: "not-a-number" },
        item_state: { id: 1, name: "sellable", label: "Vendible" },
      }).cost,
    ).toBeNull();
  });

  it("exposes only the documented fields", () => {
    const stock = {
      id: 1,
      product_id: 15,
      item_state_id: 1,
      quantity: 1,
      cost: null,
      item_state: { id: 1, name: "sellable", label: "Vendible" },
    };

    expect(Object.keys(toAvailableStock(stock))).toEqual([
      "product_id",
      "item_state_id",
      "quantity",
      "cost",
      "item_state",
    ]);
  });
});
