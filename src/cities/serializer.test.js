const { toPublicCity } = require("./serializer");

const STATE = { id: 4, name: "Aragua", code: "VE-D" };

describe("toPublicCity", () => {
  it("reads the public fields directly from a plain object", () => {
    expect(toPublicCity({ id: 10, name: "Maracay", state_id: 4 })).toEqual({
      id: 10,
      name: "Maracay",
      state_id: 4,
    });
  });

  it("omits the nested state unless includeState is requested", () => {
    const city = { id: 10, name: "Maracay", state_id: 4, state: STATE };

    expect(toPublicCity(city)).toEqual({
      id: 10,
      name: "Maracay",
      state_id: 4,
    });
    expect(toPublicCity(city, { includeState: false })).not.toHaveProperty(
      "state",
    );
  });

  it("nests the public state when includeState is requested", () => {
    const city = { id: 10, name: "Maracay", state_id: 4, state: STATE };

    expect(toPublicCity(city, { includeState: true })).toEqual({
      id: 10,
      name: "Maracay",
      state_id: 4,
      state: STATE,
    });
  });

  it("omits the state when it was not loaded", () => {
    const city = { id: 10, name: "Maracay", state_id: 4 };

    expect(toPublicCity(city, { includeState: true })).toEqual({
      id: 10,
      name: "Maracay",
      state_id: 4,
    });
  });

  it("reads the fields through get() when available", () => {
    const values = {
      id: 10,
      name: "Maracay",
      state_id: 4,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const city = { get: jest.fn((field) => values[field]) };

    expect(toPublicCity(city)).toEqual({
      id: 10,
      name: "Maracay",
      state_id: 4,
    });
    expect(city.get).toHaveBeenCalledWith("id");
  });

  it("exposes only the documented keys in order", () => {
    const city = {
      id: 10,
      name: "Maracay",
      state_id: 4,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicCity(city))).toEqual(["id", "name", "state_id"]);
  });
});
