const Supplier = require("./supplier");
const City = require("./city");
const State = require("./state");

describe("Supplier model", () => {
  it("defines the documented columns", () => {
    const attributes = Supplier.getAttributes();

    expect(attributes.name.type.toString()).toBe("VARCHAR(150)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.identification.type.toString()).toBe("VARCHAR(30)");
    expect(attributes.identification.allowNull).toBe(false);
    expect(attributes.email.type.toString()).toBe("VARCHAR(150)");
    expect(attributes.email.allowNull).toBe(false);
    expect(attributes.phone.type.toString()).toBe("VARCHAR(30)");
    expect(attributes.phone.allowNull).toBe(false);
    expect(attributes.observations.type.toString()).toBe("TEXT");
    expect(attributes.observations.allowNull).toBe(true);
    expect(attributes.address.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.address.allowNull).toBe(false);
    expect(attributes.city_id.type.key).toBe("INTEGER");
    expect(attributes.city_id.allowNull).toBe(false);
    expect(attributes.state_id.type.key).toBe("INTEGER");
    expect(attributes.state_id.allowNull).toBe(false);
  });

  it("uses the documented model and table names", () => {
    expect(Supplier.name).toBe("Supplier");
    expect(Supplier.tableName).toBe("suppliers");
  });

  it("belongs to City and State through their foreign keys", () => {
    expect(Supplier.associations.city.associationType).toBe("BelongsTo");
    expect(Supplier.associations.city.options.foreignKey).toBe("city_id");
    expect(Supplier.associations.city.options.as).toBe("city");
    expect(Supplier.associations.city.target).toBe(City);
    expect(Supplier.associations.state.associationType).toBe("BelongsTo");
    expect(Supplier.associations.state.options.foreignKey).toBe("state_id");
    expect(Supplier.associations.state.options.as).toBe("state");
    expect(Supplier.associations.state.target).toBe(State);
  });

  it("registers the inverse associations without a circular require", () => {
    expect(City.associations.suppliers.associationType).toBe("HasMany");
    expect(City.associations.suppliers.options.foreignKey).toBe("city_id");
    expect(City.associations.suppliers.options.as).toBe("suppliers");
    expect(State.associations.suppliers.associationType).toBe("HasMany");
    expect(State.associations.suppliers.options.foreignKey).toBe("state_id");
    expect(State.associations.suppliers.options.as).toBe("suppliers");
  });
});
