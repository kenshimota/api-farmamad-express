const { toPublicCategory } = require("./serializer");

describe("toPublicCategory", () => {
  it("reads the fields directly from a plain object", () => {
    expect(toPublicCategory({ id: 1, name: "Analgésicos" })).toEqual({
      id: 1,
      name: "Analgésicos",
    });
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      id: 7,
      name: "Analgésicos",
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const category = {
      get: jest.fn((field) => values[field]),
      id: 999,
      name: "Wrong",
    };

    expect(toPublicCategory(category)).toEqual({
      id: 7,
      name: "Analgésicos",
    });
    expect(category.get).toHaveBeenCalledWith("id");
  });

  it("exposes only id and name in the documented order", () => {
    const category = {
      id: 1,
      name: "Analgésicos",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicCategory(category))).toEqual(["id", "name"]);
  });
});
