const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Payment = require("./payment");
const Invoice = require("./invoice");
const User = require("./user");

/**
 * Sequelize model that represents the immutable application of one received
 * payment to one invoice. `amount` is debited from the customer wallet in the
 * payment currency while `applied_amount` is credited to the invoice in the
 * invoice currency. `exchange_rate` stores the rate used at allocation time.
 * The database enforces the positive amounts and the unique
 * `(payment_id, invoice_id)` pair.
 */
const PaymentAllocation = sequelize.define(
  "PaymentAllocation",
  {
    payment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    applied_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    exchange_rate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
    },
    allocated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "payment_allocations",
  },
);

PaymentAllocation.belongsTo(Payment, {
  foreignKey: "payment_id",
  as: "payment",
});
Payment.hasMany(PaymentAllocation, {
  foreignKey: "payment_id",
  as: "allocations",
});

PaymentAllocation.belongsTo(Invoice, {
  foreignKey: "invoice_id",
  as: "invoice",
});
Invoice.hasMany(PaymentAllocation, {
  foreignKey: "invoice_id",
  as: "payment_allocations",
});

PaymentAllocation.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "created_by",
});
User.hasMany(PaymentAllocation, {
  foreignKey: "created_by_user_id",
  as: "created_payment_allocations",
});

module.exports = PaymentAllocation;
