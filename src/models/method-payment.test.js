const MethodPayment = require("./method-payment");
const MethodPaymentType = require("./method-payment-type");
const Currency = require("./currency");

describe("MethodPayment model", () => {
  it("defines the documented columns with their limits", () => {
    const attributes = MethodPayment.getAttributes();

    expect(attributes.method_payment_type_id.type.toString()).toBe("INTEGER");
    expect(attributes.method_payment_type_id.allowNull).toBe(false);
    expect(attributes.label.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.label.allowNull).toBe(false);
    expect(attributes.details.type.toString()).toBe("JSONB");
    expect(attributes.details.allowNull).toBe(false);
    expect(attributes.details.defaultValue).toEqual({});
    expect(attributes.is_active.type.toString()).toBe("BOOLEAN");
    expect(attributes.is_active.allowNull).toBe(false);
    expect(attributes.is_active.defaultValue).toBe(true);
  });

  it("uses the documented model and table names", () => {
    expect(MethodPayment.name).toBe("MethodPayment");
    expect(MethodPayment.tableName).toBe("method_payments");
  });

  it("defaults details to an empty object and is_active to true", () => {
    const instance = MethodPayment.build({
      method_payment_type_id: 1,
      label: "PayPal",
    });

    expect(instance.get("details")).toEqual({});
    expect(instance.get("is_active")).toBe(true);
  });

  it("belongs to a method payment type", () => {
    const association = MethodPayment.associations.method_payment_type;

    expect(association).toBeDefined();
    expect(association.target).toBe(MethodPaymentType);
    expect(association.foreignKey).toBe("method_payment_type_id");
    expect(association.target.associations.currency.target).toBe(Currency);
  });

  it("is exposed as a type relation", () => {
    const association = MethodPaymentType.associations.method_payments;

    expect(association).toBeDefined();
    expect(association.target).toBe(MethodPayment);
    expect(association.foreignKey).toBe("method_payment_type_id");
  });
});
