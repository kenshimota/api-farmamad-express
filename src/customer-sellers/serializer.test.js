const { toAssignedAt, toPublicCustomerSeller } = require("./serializer");

const ASSIGNMENT = {
  id: 1,
  customer_id: 8,
  seller_id: 12,
  assigned_at: new Date("2026-10-29T16:00:00.000Z"),
  createdAt: new Date("2026-10-29T16:00:00.000Z"),
  updatedAt: new Date("2026-10-29T16:00:00.000Z"),
  customer: {
    id: 8,
    fullName: "Juan Pérez",
    email: "juan@example.com",
    direction: "Av. Monseñor Rivero 123",
    latitude: "-17.7833000",
    longitude: "-63.1821000",
    isRegistered: false,
  },
  seller: {
    id: 12,
    username: "vendedor1",
    email: "vendedor1@farmamad.com",
    name: "Carlos Gómez",
    password: "hash",
    roleId: 3,
    isBlocked: false,
  },
};

describe("toAssignedAt", () => {
  it("serializes a Date as ISO and keeps strings", () => {
    expect(toAssignedAt(new Date("2026-10-29T16:00:00.000Z"))).toBe(
      "2026-10-29T16:00:00.000Z",
    );
    expect(toAssignedAt("2026-10-29T16:00:00.000Z")).toBe(
      "2026-10-29T16:00:00.000Z",
    );
  });

  it("returns null for empty values", () => {
    expect(toAssignedAt(null)).toBeNull();
    expect(toAssignedAt(undefined)).toBeNull();
  });
});

describe("toPublicCustomerSeller", () => {
  it("exposes the documented fields and nested relations only", () => {
    expect(toPublicCustomerSeller(ASSIGNMENT)).toEqual({
      id: 1,
      customer_id: 8,
      seller_id: 12,
      assigned_at: "2026-10-29T16:00:00.000Z",
      customer: {
        id: 8,
        fullName: "Juan Pérez",
        email: "juan@example.com",
        direction: "Av. Monseñor Rivero 123",
      },
      seller: {
        id: 12,
        username: "vendedor1",
        email: "vendedor1@farmamad.com",
        name: "Carlos Gómez",
      },
    });
  });

  it("never exposes audit columns, password or roleId", () => {
    const result = toPublicCustomerSeller(ASSIGNMENT);

    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result.seller).not.toHaveProperty("password");
    expect(result.seller).not.toHaveProperty("roleId");
    expect(result.customer).not.toHaveProperty("latitude");
  });

  it("keeps null nested relations and the documented key order", () => {
    const result = toPublicCustomerSeller({
      ...ASSIGNMENT,
      customer: null,
      seller: null,
    });

    expect(result.customer).toBeNull();
    expect(result.seller).toBeNull();
    expect(Object.keys(result)).toEqual([
      "id",
      "customer_id",
      "seller_id",
      "assigned_at",
      "customer",
      "seller",
    ]);
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const assignment = {
      get: jest.fn((field) => ASSIGNMENT[field]),
    };

    expect(toPublicCustomerSeller(assignment).id).toBe(1);
    expect(assignment.get).toHaveBeenCalledWith("customer_id");
    expect(assignment.get).toHaveBeenCalledWith("assigned_at");
  });
});
