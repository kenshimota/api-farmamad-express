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
      price_list_id: null,
      price_list: null,
      payment_term_id: null,
      payment_term: null,
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
      price_list_id: null,
      price_list: null,
      payment_term_id: null,
      payment_term: null,
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
      price_list_id: null,
      price_list: null,
      payment_term_id: null,
      payment_term: null,
    });
  });

  it("includes the assigned price list summary without the margin", () => {
    const customer = {
      id: 1,
      fullName: "Juan Pérez",
      latitude: "-17.7833000",
      longitude: "-63.1821000",
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
      price_list_id: 3,
      price_list: {
        id: 3,
        name: "Mayorista 30",
        percentage: "30.00",
        description: "internal",
      },
    };

    expect(toPublicCustomer(customer)).toEqual({
      id: 1,
      fullName: "Juan Pérez",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
      price_list_id: 3,
      price_list: { id: 3, name: "Mayorista 30" },
      payment_term_id: null,
      payment_term: null,
    });
  });

  it("includes the assigned payment term summary", () => {
    const customer = {
      id: 1,
      fullName: "Juan Pérez",
      latitude: "-17.7833000",
      longitude: "-63.1821000",
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
      payment_term_id: 3,
      payment_term: {
        id: 3,
        code: "credit_15",
        name: "Crédito 15 días",
        days: 15,
        description: "internal",
        is_active: true,
      },
    };

    expect(toPublicCustomer(customer)).toEqual({
      id: 1,
      fullName: "Juan Pérez",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "juan@example.com",
      price_list_id: null,
      price_list: null,
      payment_term_id: 3,
      payment_term: {
        id: 3,
        code: "credit_15",
        name: "Crédito 15 días",
        days: 15,
      },
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
      "price_list_id",
      "price_list",
      "payment_term_id",
      "payment_term",
    ]);
  });
});
