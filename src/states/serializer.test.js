const { toPublicState } = require("./serializer");

describe("toPublicState", () => {
  it("reads the fields directly from a plain object", () => {
    expect(toPublicState({ id: 1, name: "Aragua", code: "VE-D" })).toEqual({
      id: 1,
      name: "Aragua",
      code: "VE-D",
    });
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      id: 7,
      name: "Aragua",
      code: "VE-D",
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const state = {
      get: jest.fn((field) => values[field]),
      id: 999,
      name: "Wrong",
      code: "WRONG",
    };

    expect(toPublicState(state)).toEqual({
      id: 7,
      name: "Aragua",
      code: "VE-D",
    });
    expect(state.get).toHaveBeenCalledWith("id");
  });

  it("exposes only id, name and code in the documented order", () => {
    const state = {
      id: 1,
      name: "Aragua",
      code: "VE-D",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicState(state))).toEqual(["id", "name", "code"]);
  });
});
