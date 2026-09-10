const Role = require("./role");
require("./user");

describe("Role model", () => {
  it("defines a required unique name in the roles table", () => {
    const attributes = Role.getAttributes();

    expect(Role.tableName).toBe("roles");
    expect(attributes.id).toBeDefined();
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.name.unique).toBe(true);
  });

  it("has many users", () => {
    expect(Role.associations.users).toBeDefined();
    expect(Role.associations.users.as).toBe("users");
    expect(Role.associations.users.foreignKey).toBe("roleId");
  });
});
