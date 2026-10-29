const { toPublicItemState } = require("./serializer");

describe("toPublicItemState", () => {
  it("reads the fields directly from a plain object", () => {
    expect(
      toPublicItemState({
        id: 1,
        name: "sellable",
        label: "Vendible",
        description: null,
        is_sellable: true,
      }),
    ).toEqual({
      id: 1,
      name: "sellable",
      label: "Vendible",
      description: null,
      is_sellable: true,
    });
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      id: 7,
      name: "damaged",
      label: "Maltratado",
      description: "Producto con daño físico",
      is_sellable: false,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const itemState = {
      get: jest.fn((field) => values[field]),
      id: 999,
      name: "Wrong",
    };

    expect(toPublicItemState(itemState)).toEqual({
      id: 7,
      name: "damaged",
      label: "Maltratado",
      description: "Producto con daño físico",
      is_sellable: false,
    });
    expect(itemState.get).toHaveBeenCalledWith("id");
  });

  it("exposes only the documented fields in order and no timestamps", () => {
    const itemState = {
      id: 1,
      name: "sellable",
      label: "Vendible",
      description: null,
      is_sellable: true,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicItemState(itemState))).toEqual([
      "id",
      "name",
      "label",
      "description",
      "is_sellable",
    ]);
  });
});
