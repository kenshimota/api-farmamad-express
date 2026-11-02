const { toPublicPriceList } = require("./serializer");

describe("toPublicPriceList", () => {
  it("converts the DECIMAL percentage into a number", () => {
    const list = {
      id: 1,
      name: "Mayorista 30",
      description: "Margen del 30 %",
      percentage: "30.00",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(toPublicPriceList(list)).toEqual({
      id: 1,
      name: "Mayorista 30",
      description: "Margen del 30 %",
      percentage: 30,
    });
  });

  it("exposes only the documented fields and keeps null descriptions", () => {
    const list = {
      id: 2,
      name: "Base",
      description: null,
      percentage: "0.00",
    };

    expect(Object.keys(toPublicPriceList(list))).toEqual([
      "id",
      "name",
      "description",
      "percentage",
    ]);
    expect(toPublicPriceList(list).description).toBeNull();
    expect(toPublicPriceList(list).percentage).toBe(0);
  });

  it("reads the fields from a Sequelize-like instance", () => {
    const values = {
      id: 3,
      name: "Fino",
      description: "Margen fino",
      percentage: "12.34",
    };
    const list = { get: jest.fn((field) => values[field]) };

    expect(toPublicPriceList(list)).toEqual({
      id: 3,
      name: "Fino",
      description: "Margen fino",
      percentage: 12.34,
    });
  });
});
