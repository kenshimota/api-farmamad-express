const PaymentAllocation = require("./payment-allocation");
const Payment = require("./payment");
const Invoice = require("./invoice");
const User = require("./user");
const WalletTransaction = require("./wallet-transaction");

describe("PaymentAllocation model", () => {
  it("uses the payment_allocations table and money attributes", () => {
    const attributes = PaymentAllocation.getAttributes();

    expect(PaymentAllocation.name).toBe("PaymentAllocation");
    expect(PaymentAllocation.tableName).toBe("payment_allocations");
    expect(attributes.payment_id.allowNull).toBe(false);
    expect(attributes.invoice_id.allowNull).toBe(false);
    expect(attributes.amount.type.toString()).toBe("DECIMAL(14,2)");
    expect(attributes.applied_amount.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.exchange_rate.type.toString()).toBe("DECIMAL(18,6)");
    expect(attributes.allocated_at.allowNull).toBe(false);
    expect(attributes.created_by_user_id.allowNull).toBe(false);
  });

  it("belongs to the payment, invoice and author", () => {
    expect(PaymentAllocation.associations.payment.target).toBe(Payment);
    expect(PaymentAllocation.associations.payment.foreignKey).toBe(
      "payment_id",
    );
    expect(PaymentAllocation.associations.invoice.target).toBe(Invoice);
    expect(PaymentAllocation.associations.invoice.foreignKey).toBe(
      "invoice_id",
    );
    expect(PaymentAllocation.associations.created_by.target).toBe(User);
    expect(PaymentAllocation.associations.created_by.foreignKey).toBe(
      "created_by_user_id",
    );
  });

  it("registers the inverse associations and the wallet movement", () => {
    expect(Payment.associations.allocations.target).toBe(PaymentAllocation);
    expect(Invoice.associations.payment_allocations.target).toBe(
      PaymentAllocation,
    );
    expect(WalletTransaction.associations.payment_allocation.target).toBe(
      PaymentAllocation,
    );
    expect(PaymentAllocation.associations.wallet_transaction.target).toBe(
      WalletTransaction,
    );
  });
});
