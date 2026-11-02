const WalletTransaction = require("./wallet-transaction");
const CustomerWallet = require("./customer-wallet");
const Payment = require("./payment");
const User = require("./user");

describe("WalletTransaction model", () => {
  it("is append-only and uses the wallet_transactions table", () => {
    const attributes = WalletTransaction.getAttributes();

    expect(WalletTransaction.name).toBe("WalletTransaction");
    expect(WalletTransaction.tableName).toBe("wallet_transactions");
    expect(attributes.transaction_type.allowNull).toBe(false);
    expect(attributes.amount.type.toString()).toBe("DECIMAL(14,2)");
    expect(attributes.balance_after.type.toString()).toBe("DECIMAL(14,2)");
    expect(attributes.payment_id.allowNull).toBe(true);
    expect(attributes.invoice_id.allowNull).toBe(true);
    expect(attributes.payment_allocation_id.allowNull).toBe(true);
    expect(attributes.description.type.toString()).toBe("VARCHAR(255)");
  });

  it("belongs to the wallet, payment and author", () => {
    expect(WalletTransaction.associations.wallet.target).toBe(CustomerWallet);
    expect(WalletTransaction.associations.payment.target).toBe(Payment);
    expect(WalletTransaction.associations.created_by.target).toBe(User);
    expect(WalletTransaction.associations.created_by.foreignKey).toBe(
      "created_by_user_id",
    );
  });
});
