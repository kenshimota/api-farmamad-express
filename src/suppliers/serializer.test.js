const { toPublicSupplier } = require("./serializer");

const CITY = { id: 10, name: "Maracay", state_id: 4 };
const STATE = { id: 4, name: "Aragua", code: "VE-D" };
const SUPPLIER = {
  id: 1,
  name: "Distribuidora La Salud C.A.",
  identification: "J-12345678-9",
  email: "ventas@lasalud.com",
  phone: "+58 212 555-1234",
  observations: "Entrega los martes",
  address: "Av. Principal, Galpón 4",
  city_id: 10,
  state_id: 4,
};

describe("toPublicSupplier", () => {
  it("reads the public fields directly from a plain object", () => {
    expect(toPublicSupplier(SUPPLIER)).toEqual(SUPPLIER);
  });

  it("omits the nested location unless includeLocation is requested", () => {
    const supplier = { ...SUPPLIER, city: CITY, state: STATE };

    expect(toPublicSupplier(supplier)).toEqual(SUPPLIER);
    expect(toPublicSupplier(supplier, { includeLocation: false })).toEqual(
      SUPPLIER,
    );
  });

  it("nests the city with id and name and the public state", () => {
    const supplier = { ...SUPPLIER, city: CITY, state: STATE };

    expect(toPublicSupplier(supplier, { includeLocation: true })).toEqual({
      ...SUPPLIER,
      city: { id: 10, name: "Maracay" },
      state: { id: 4, name: "Aragua", code: "VE-D" },
    });
  });

  it("omits a nested relation that was not loaded", () => {
    const supplier = { ...SUPPLIER, city: CITY };

    expect(toPublicSupplier(supplier, { includeLocation: true })).toEqual({
      ...SUPPLIER,
      city: { id: 10, name: "Maracay" },
    });
  });

  it("reads the fields through get() when available", () => {
    const values = {
      ...SUPPLIER,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const supplier = { get: jest.fn((field) => values[field]) };

    expect(toPublicSupplier(supplier)).toEqual(SUPPLIER);
    expect(supplier.get).toHaveBeenCalledWith("id");
  });

  it("exposes only the documented keys in order", () => {
    const supplier = {
      ...SUPPLIER,
      city: CITY,
      state: STATE,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    expect(
      Object.keys(toPublicSupplier(supplier, { includeLocation: true })),
    ).toEqual([
      "id",
      "name",
      "identification",
      "email",
      "phone",
      "observations",
      "address",
      "city_id",
      "state_id",
      "city",
      "state",
    ]);
  });
});
