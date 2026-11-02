const PaymentStatus = require("./payment-status");

describe("PaymentStatus model", () => {
  it("uses the payment_statuses table and catalog attributes", () => {
    const attributes = PaymentStatus.getAttributes();

    expect(PaymentStatus.tableName).toBe("payment_statuses");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.code.unique).toBe(true);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.description.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.sort_order.allowNull).toBe(false);
    expect(attributes.is_system.allowNull).toBe(false);
    expect(attributes.is_system.defaultValue).toBe(false);
  });
});
