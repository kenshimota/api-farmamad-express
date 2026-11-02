const CustomerWallet = require("./customer-wallet");
const Customer = require("./customer");
const Currency = require("./currency");

describe("CustomerWallet model", () => {
  it("uses the customer_wallets table and money attributes", () => {
    const attributes = CustomerWallet.getAttributes();

    expect(CustomerWallet.name).toBe("CustomerWallet");
    expect(CustomerWallet.tableName).toBe("customer_wallets");
    expect(attributes.customer_id.allowNull).toBe(false);
    expect(attributes.currency_id.allowNull).toBe(false);
    expect(attributes.balance.type.toString()).toBe("DECIMAL(14,2)");
    expect(attributes.balance.defaultValue).toBe(0);
  });

  it("belongs to a customer and a currency", () => {
    expect(CustomerWallet.associations.customer.target).toBe(Customer);
    expect(CustomerWallet.associations.customer.foreignKey).toBe("customer_id");
    expect(CustomerWallet.associations.currency.target).toBe(Currency);
    expect(CustomerWallet.associations.currency.foreignKey).toBe("currency_id");
    expect(Customer.associations.customer_wallets.target).toBe(CustomerWallet);
  });
});
