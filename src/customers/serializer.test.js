const { toPublicCustomer } = require("./serializer");

describe("toPublicCustomer", () => {
  it("reads the fields directly from a plain object", () => {
    const customer = {
      id: 1,
      fullName: "Juan Pérez",
      latitude: "-17.7833000",
      longitude: "-63.1821000",
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    };

    expect(toPublicCustomer(customer)).toEqual({
      id: 1,
      fullName: "Juan Pérez",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    });
  });

  it("prefers the get() accessor over direct properties", () => {
    const values = {
      id: 7,
      fullName: "Ana Gómez",
      latitude: "-17.7900000",
      longitude: "-63.1900000",
      direction: "Calle 2 #45",
      email: "ana@example.com",
      isRegistered: true,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const customer = {
      get: jest.fn((field) => values[field]),
      id: 999,
      fullName: "Wrong",
      latitude: "0",
      longitude: "0",
      direction: "Wrong",
      email: "wrong@example.com",
    };

    expect(toPublicCustomer(customer)).toEqual({
      id: 7,
      fullName: "Ana Gómez",
      latitude: -17.79,
      longitude: -63.19,
      direction: "Calle 2 #45",
      email: "ana@example.com",
    });
    expect(customer.get).toHaveBeenCalledWith("id");
  });

  it("returns null for null and undefined coordinates", () => {
    const customer = {
      id: 1,
      fullName: "Juan Pérez",
      latitude: null,
      longitude: undefined,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    };

    expect(toPublicCustomer(customer)).toEqual({
      id: 1,
      fullName: "Juan Pérez",
      latitude: null,
      longitude: null,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
    });
  });

  it("exposes only the public fields", () => {
    const customer = {
      id: 1,
      fullName: "Juan Pérez",
      latitude: "-17.7833000",
      longitude: "-63.1821000",
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
      isRegistered: true,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(Object.keys(toPublicCustomer(customer))).toEqual([
      "id",
      "fullName",
      "latitude",
      "longitude",
      "direction",
      "email",
    ]);
  });
});
