const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const CustomerWallet = require("./customer-wallet");
const Payment = require("./payment");
const PaymentAllocation = require("./payment-allocation");
const User = require("./user");

/**
 * Sequelize model that represents one append-only movement of a customer
 * wallet. A positive amount credits the wallet and a negative one debits it;
 * `balance_after` stores the resulting balance. There are no API endpoints to
 * edit or delete movements.
 *
 * `invoice_id` references the invoices table added by HU-40 and
 * `payment_allocation_id` references the immutable allocation that produced an
 * `invoice_payment` movement added by HU-43.
 */
const WalletTransaction = sequelize.define(
  "WalletTransaction",
  {
    wallet_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    transaction_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    payment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payment_allocation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "wallet_transactions",
  },
);

WalletTransaction.belongsTo(CustomerWallet, {
  foreignKey: "wallet_id",
  as: "wallet",
});
CustomerWallet.hasMany(WalletTransaction, {
  foreignKey: "wallet_id",
  as: "transactions",
});

WalletTransaction.belongsTo(Payment, {
  foreignKey: "payment_id",
  as: "payment",
});
Payment.hasMany(WalletTransaction, {
  foreignKey: "payment_id",
  as: "wallet_transactions",
});

WalletTransaction.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "created_by",
});
User.hasMany(WalletTransaction, {
  foreignKey: "created_by_user_id",
  as: "created_wallet_transactions",
});

WalletTransaction.belongsTo(PaymentAllocation, {
  foreignKey: "payment_allocation_id",
  as: "payment_allocation",
});
PaymentAllocation.hasOne(WalletTransaction, {
  foreignKey: "payment_allocation_id",
  as: "wallet_transaction",
});

module.exports = WalletTransaction;
