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

  it("never exposes the password or the roleId", () => {
    const result = toPublicUser(user, "customer");

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("roleId");
  });
});
