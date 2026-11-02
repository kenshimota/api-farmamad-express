const { getRoleName, toPublicUser } = require("./serializers");

const user = {
  id: 1,
  username: "juan",
  email: "juan@example.com",
  name: "Juan",
  password: "hash",
  roleId: 3,
  isBlocked: false,
};

describe("getRoleName", () => {
  it("returns the name when the role is an included model", () => {
    expect(getRoleName({ role: { name: "seller" } })).toBe("seller");
  });

  it("returns the role when it is already a string", () => {
    expect(getRoleName({ role: "customer" })).toBe("customer");
  });

  it("returns undefined when there is no role", () => {
    expect(getRoleName({})).toBeUndefined();
    expect(getRoleName(null)).toBeUndefined();
  });
});

describe("toPublicUser", () => {
  it("builds the public representation with an explicit role name", () => {
    expect(toPublicUser(user, "admin")).toEqual({
      id: 1,
      username: "juan",
      email: "juan@example.com",
      name: "Juan",
      role: "admin",
      isBlocked: false,
    });
  });

  it("derives the role name from an included role", () => {
    expect(toPublicUser({ ...user, role: { name: "customer" } })).toEqual({
      id: 1,
      username: "juan",
      email: "juan@example.com",
      name: "Juan",
      role: "customer",
      isBlocked: false,
    });
  });

  it("exposes the current isBlocked flag", () => {
    expect(toPublicUser({ ...user, isBlocked: true }, "customer")).toEqual(
      expect.objectContaining({ isBlocked: true }),
    );
  });

  it("normalizes a missing isBlocked flag to false", () => {
    const result = toPublicUser(
      { id: 1, username: "juan", email: "j@example.com", name: "Juan" },
      "customer",
    );

    expect(result.isBlocked).toBe(false);
  });

  it("never exposes the password or the roleId", () => {
    const result = toPublicUser(user, "customer");

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("roleId");
  });

  it("keeps the customer fields out by default", () => {
    const result = toPublicUser({ ...user, customer_id: 8 }, "customer");

    expect(result).not.toHaveProperty("customer_id");
    expect(result).not.toHaveProperty("customer");
  });

  it("adds null customer fields when includeCustomer is requested", () => {
    const result = toPublicUser(user, "customer", { includeCustomer: true });

    expect(result.customer_id).toBeNull();
    expect(result.customer).toBeNull();
  });

  it("serializes the linked customer with the public customer fields", () => {
    const linked = {
      ...user,
      customer_id: 8,
      customer: {
        id: 8,
        fullName: "Cliente Demo",
        latitude: "-17.7833000",
        longitude: "-63.1821000",
        direction: "Av. Monseñor Rivero 123",
        email: "cliente@example.com",
        isRegistered: true,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    };

    const result = toPublicUser(linked, "customer", { includeCustomer: true });

    expect(result.customer_id).toBe(8);
    expect(result.customer).toEqual({
      id: 8,
      fullName: "Cliente Demo",
      latitude: -17.7833,
      longitude: -63.1821,
      direction: "Av. Monseñor Rivero 123",
      email: "cliente@example.com",
    });
    expect(result.customer).not.toHaveProperty("isRegistered");
    expect(result.customer).not.toHaveProperty("createdAt");
  });

  it("derives customer_id from the linked customer when it is missing", () => {
    const linked = {
      ...user,
      customer: { id: 8, fullName: "Cliente Demo" },
    };

    const result = toPublicUser(linked, "customer", { includeCustomer: true });

    expect(result.customer_id).toBe(8);
  });
});
