const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");
const Currency = require("./currency");
const MethodPayment = require("./method-payment");
const User = require("./user");

/**
 * Sequelize model that represents money actually received from a customer.
 * The currency is copied from the payment method type and is never accepted in
 * the request body. Creating a payment also credits the matching wallet and
 * appends a `deposit` wallet transaction.
 */
const Payment = sequelize.define(
  "Payment",
  {
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    method_payment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "payments",
  },
);

Payment.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Customer.hasMany(Payment, { foreignKey: "customer_id", as: "payments" });

Payment.belongsTo(MethodPayment, {
  foreignKey: "method_payment_id",
  as: "method_payment",
});
MethodPayment.hasMany(Payment, {
  foreignKey: "method_payment_id",
  as: "payments",
});

Payment.belongsTo(Currency, { foreignKey: "currency_id", as: "currency" });
Currency.hasMany(Payment, { foreignKey: "currency_id", as: "payments" });

Payment.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "created_by",
});
User.hasMany(Payment, {
  foreignKey: "created_by_user_id",
  as: "created_payments",
});

module.exports = Payment;
