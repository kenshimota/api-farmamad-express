const Invoice = require("./invoice");
const Customer = require("./customer");
const Currency = require("./currency");
const User = require("./user");
const PaymentTerm = require("./payment-term");

describe("Invoice model", () => {
  it("maps the invoices table", () => {
    expect(Invoice.name).toBe("Invoice");
    expect(Invoice.tableName).toBe("invoices");
  });

  it("defines the documented columns and defaults", () => {
    const attributes = Invoice.getAttributes();

    expect(attributes.number.allowNull).toBe(false);
    expect(attributes.number.unique).toBe(true);
    expect(attributes.order_id.allowNull).toBe(true);
    expect(attributes.order_id.unique).toBe(true);
    expect(attributes.customer_id.allowNull).toBe(false);
    expect(attributes.invoiced_by_user_id.allowNull).toBe(false);
    expect(attributes.currency_id.allowNull).toBe(false);
    expect(attributes.payment_term_id.allowNull).toBe(false);
    expect(attributes.subtotal.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.tax_amount.defaultValue).toBe(0);
    expect(attributes.paid_amount.defaultValue).toBe(0);
    expect(attributes.payment_status.defaultValue).toBe("pending");
    expect(attributes.issued_at.allowNull).toBe(false);
    expect(attributes.due_date.allowNull).toBe(false);
    expect(attributes.due_date.type.toString()).toBe("DATE");
    expect(attributes.notes.allowNull).toBe(true);
  });

  it("belongs to the customer, the issuing user and the currency", () => {
    expect(Invoice.associations.customer.target).toBe(Customer);
    expect(Invoice.associations.customer.foreignKey).toBe("customer_id");
    expect(Invoice.associations.invoiced_by.target).toBe(User);
    expect(Invoice.associations.invoiced_by.foreignKey).toBe(
      "invoiced_by_user_id",
    );
    expect(Invoice.associations.currency.target).toBe(Currency);
    expect(Invoice.associations.currency.foreignKey).toBe("currency_id");
    expect(Invoice.associations.payment_term.target).toBe(PaymentTerm);
    expect(Invoice.associations.payment_term.foreignKey).toBe(
      "payment_term_id",
    );
  });

  it("registers the inverse associations", () => {
    expect(Customer.associations.invoices.target).toBe(Invoice);
    expect(User.associations.issued_invoices.target).toBe(Invoice);
    expect(Currency.associations.invoices.target).toBe(Invoice);
  });
});
