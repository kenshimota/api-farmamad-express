const Tax = require("./tax");

describe("Tax model", () => {
  it("defines the documented columns with their limits", () => {
    const attributes = Tax.getAttributes();

    expect(attributes.code.type.toString()).toBe("VARCHAR(20)");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.rate.type.toString()).toBe("DECIMAL(5,2)");
    expect(attributes.rate.allowNull).toBe(false);
    expect(attributes.description.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.description.allowNull).toBe(true);
    expect(attributes.description.defaultValue).toBeNull();
    expect(attributes.is_active.type.toString()).toBe("BOOLEAN");
    expect(attributes.is_active.allowNull).toBe(false);
    expect(attributes.is_active.defaultValue).toBe(true);
  });

  it("uses the documented model and table names", () => {
    expect(Tax.name).toBe("Tax");
    expect(Tax.tableName).toBe("taxes");
  });

  it("defaults is_active to true when a tax is built", () => {
    const instance = Tax.build({
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: "16.00",
    });

    expect(instance.get("is_active")).toBe(true);
  });
});
