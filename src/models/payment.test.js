const Payment = require("./payment");
const Customer = require("./customer");
const Currency = require("./currency");
const MethodPayment = require("./method-payment");
const User = require("./user");

describe("Payment model", () => {
  it("uses the payments table and money attributes", () => {
    const attributes = Payment.getAttributes();

    expect(Payment.name).toBe("Payment");
    expect(Payment.tableName).toBe("payments");
    expect(attributes.customer_id.allowNull).toBe(false);
    expect(attributes.method_payment_id.allowNull).toBe(false);
    expect(attributes.currency_id.allowNull).toBe(false);
    expect(attributes.amount.type.toString()).toBe("DECIMAL(14,2)");
    expect(attributes.reference.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.notes.type.toString()).toBe("TEXT");
    expect(attributes.created_by_user_id.allowNull).toBe(false);
  });

  it("belongs to the customer, method, currency and author", () => {
    expect(Payment.associations.customer.target).toBe(Customer);
    expect(Payment.associations.method_payment.target).toBe(MethodPayment);
    expect(Payment.associations.currency.target).toBe(Currency);
    expect(Payment.associations.created_by.target).toBe(User);
    expect(Payment.associations.created_by.foreignKey).toBe(
      "created_by_user_id",
    );
  });
});
