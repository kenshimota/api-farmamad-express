const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");
const Currency = require("./currency");

/**
 * Sequelize model that represents the money available for one customer in one
 * currency. There is at most one wallet per `(customer_id, currency_id)`, and
 * `balance` must always equal the sum of its `wallet_transactions.amount`.
 * The wallet is created automatically by the first deposit.
 */
const CustomerWallet = sequelize.define(
  "CustomerWallet",
  {
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "customer_wallets",
  },
);

CustomerWallet.belongsTo(Customer, {
  foreignKey: "customer_id",
  as: "customer",
});
Customer.hasMany(CustomerWallet, {
  foreignKey: "customer_id",
  as: "customer_wallets",
});

CustomerWallet.belongsTo(Currency, {
  foreignKey: "currency_id",
  as: "currency",
});
Currency.hasMany(CustomerWallet, {
  foreignKey: "currency_id",
  as: "customer_wallets",
});

module.exports = CustomerWallet;
