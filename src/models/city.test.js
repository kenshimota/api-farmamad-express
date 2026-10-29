const City = require("./city");
const State = require("./state");

describe("City model", () => {
  it("defines name and state_id as required columns", () => {
    const attributes = City.getAttributes();

    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.state_id.type.key).toBe("INTEGER");
    expect(attributes.state_id.allowNull).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(City.name).toBe("City");
    expect(City.tableName).toBe("cities");
  });

  it("belongs to State through state_id", () => {
    expect(City.associations.state.associationType).toBe("BelongsTo");
    expect(City.associations.state.options.foreignKey).toBe("state_id");
    expect(City.associations.state.options.as).toBe("state");
    expect(City.associations.state.target).toBe(State);
  });
});
