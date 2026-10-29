const { toPublicWarehouse } = require("./serializer");

describe("toPublicWarehouse", () => {
  it("reads the fields directly from a plain object", () => {
    const warehouse = {
      id: 1,
      name: "Bodega Central",
      observations: "Horario de 8 a 18",
      address: "Av. Monseñor Rivero 123",
    };

    expect(toPublicWarehouse(warehouse)).toEqual({
      id: 1,
      name: "Bodega Central",
      observations: "Horario de 8 a 18",
      address: "Av. Monseñor Rivero 123",
    });
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      id: 7,
      name: "Bodega Norte",
      observations: null,
      address: "Calle 2 #45",
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const warehouse = {
      get: jest.fn((field) => values[field]),
      id: 999,
      name: "Wrong",
      observations: "Wrong",
      address: "Wrong",
    };

    expect(toPublicWarehouse(warehouse)).toEqual({
      id: 7,
      name: "Bodega Norte",
      observations: null,
      address: "Calle 2 #45",
    });
    expect(warehouse.get).toHaveBeenCalledWith("id");
  });

  it("exposes only the public fields in the documented order", () => {
    const warehouse = {
      id: 1,
      name: "Bodega Central",
      observations: "Horario de 8 a 18",
      address: "Av. Monseñor Rivero 123",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicWarehouse(warehouse))).toEqual([
      "id",
      "name",
      "observations",
      "address",
    ]);
  });
});
