const State = require("./state");
require("./city");

describe("State model", () => {
  it("defines name and code as required unique columns", () => {
    const attributes = State.getAttributes();

    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.name.unique).toBe(true);
    expect(attributes.code.type.toString()).toBe("VARCHAR(10)");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.code.unique).toBe(true);
  });

  it("uses the documented model and table names", () => {
    expect(State.name).toBe("State");
    expect(State.tableName).toBe("states");
  });

  it("has many cities", () => {
    expect(State.associations.cities.associationType).toBe("HasMany");
    expect(State.associations.cities.options.foreignKey).toBe("state_id");
    expect(State.associations.cities.options.as).toBe("cities");
  });
});
