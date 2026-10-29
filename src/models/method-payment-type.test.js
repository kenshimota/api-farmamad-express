const MethodPaymentType = require("./method-payment-type");
const Currency = require("./currency");

describe("MethodPaymentType model", () => {
  it("defines the documented columns with their limits", () => {
    const attributes = MethodPaymentType.getAttributes();

    expect(attributes.code.type.toString()).toBe("VARCHAR(30)");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.currency_id.type.toString()).toBe("INTEGER");
    expect(attributes.currency_id.allowNull).toBe(false);
    expect(attributes.fields.type.toString()).toBe("JSONB");
    expect(attributes.fields.allowNull).toBe(false);
    expect(attributes.fields.defaultValue).toEqual([]);
    expect(attributes.description.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.description.allowNull).toBe(true);
    expect(attributes.description.defaultValue).toBeNull();
    expect(attributes.is_active.type.toString()).toBe("BOOLEAN");
    expect(attributes.is_active.allowNull).toBe(false);
    expect(attributes.is_active.defaultValue).toBe(true);
  });

  it("uses the documented model and table names", () => {
    expect(MethodPaymentType.name).toBe("MethodPaymentType");
    expect(MethodPaymentType.tableName).toBe("method_payment_types");
  });

  it("defaults fields to an empty array and is_active to true", () => {
    const instance = MethodPaymentType.build({
      code: "PAYPAL",
      name: "PayPal",
      currency_id: 3,
    });

    expect(instance.get("fields")).toEqual([]);
    expect(instance.get("is_active")).toBe(true);
  });

  it("associates each type with one currency", () => {
    const association = MethodPaymentType.associations.currency;

    expect(association).toBeDefined();
    expect(association.target).toBe(Currency);
    expect(association.foreignKey).toBe("currency_id");
  });
});
