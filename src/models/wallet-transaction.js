const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const CustomerWallet = require("./customer-wallet");
const Payment = require("./payment");
const User = require("./user");

/**
 * Sequelize model that represents one append-only movement of a customer
 * wallet. A positive amount credits the wallet and a negative one debits it;
 * `balance_after` stores the resulting balance. There are no API endpoints to
 * edit or delete movements.
 *
 * `invoice_id` and `payment_allocation_id` stay nullable and without a foreign
 * key on purpose: the invoices and payment allocations tables belong to
 * HU-40/HU-43 and do not exist in this branch yet. The integration point is
 * documented in the migration and in the README.
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

module.exports = WalletTransaction;
