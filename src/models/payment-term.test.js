const PaymentTerm = require("./payment-term");
const Customer = require("./customer");
const Order = require("./order");
const Invoice = require("./invoice");

describe("PaymentTerm model", () => {
  it("maps the payment_terms table", () => {
    expect(PaymentTerm.name).toBe("PaymentTerm");
    expect(PaymentTerm.tableName).toBe("payment_terms");
  });

  it("defines the documented columns and defaults", () => {
    const attributes = PaymentTerm.getAttributes();

    expect(attributes.code.type.toString()).toBe("VARCHAR(30)");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.description.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.description.allowNull).toBe(true);
    expect(attributes.description.defaultValue).toBeNull();
    expect(attributes.days.type.toString()).toBe("INTEGER");
    expect(attributes.days.allowNull).toBe(false);
    expect(attributes.is_active.type.toString()).toBe("BOOLEAN");
    expect(attributes.is_active.allowNull).toBe(false);
    expect(attributes.is_active.defaultValue).toBe(true);
  });

  it("is associated with customers, orders and invoices", () => {
    expect(Customer.associations.payment_term.target).toBe(PaymentTerm);
    expect(Customer.associations.payment_term.foreignKey).toBe(
      "payment_term_id",
    );
    expect(Order.associations.payment_term.target).toBe(PaymentTerm);
    expect(Order.associations.payment_term.foreignKey).toBe("payment_term_id");
    expect(Invoice.associations.payment_term.target).toBe(PaymentTerm);
    expect(Invoice.associations.payment_term.foreignKey).toBe(
      "payment_term_id",
    );
  });

  it("exposes the inverse associations", () => {
    expect(PaymentTerm.associations.customers.target).toBe(Customer);
    expect(PaymentTerm.associations.orders.target).toBe(Order);
    expect(PaymentTerm.associations.invoices.target).toBe(Invoice);
  });
});
