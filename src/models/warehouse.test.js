const Warehouse = require("./warehouse");

describe("Warehouse model", () => {
  it("defines the required name and address fields", () => {
    const attributes = Warehouse.getAttributes();

    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.address.allowNull).toBe(false);
    expect(attributes.name.unique).not.toBe(true);
  });

  it("defines observations as an optional TEXT column defaulting to null", () => {
    const attributes = Warehouse.getAttributes();

    expect(attributes.observations.type.toString()).toBe("TEXT");
    expect(attributes.observations.allowNull).toBe(true);
    expect(attributes.observations.defaultValue).toBeNull();
  });

  it("uses the documented model and table names", () => {
    expect(Warehouse.name).toBe("Warehouse");
    expect(Warehouse.tableName).toBe("warehouses");
  });
});
