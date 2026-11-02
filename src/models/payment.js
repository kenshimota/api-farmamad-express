const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");
const Currency = require("./currency");
const MethodPayment = require("./method-payment");
const Image = require("./image");
const PaymentStatus = require("./payment-status");
const PaymentStatusHistory = require("./payment-status-history");
const User = require("./user");

/**
 * Sequelize model that represents money actually received from a customer.
 * The currency is copied from the payment method type and is never accepted in
 * the request body. A new payment is `pending` and does not touch the wallet;
 * conciliating it appends the `deposit` movement atomically. Every status
 * change is audited in `payment_status_history`.
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
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    rejection_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    reference_image_id: {
      type: DataTypes.INTEGER,
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

Payment.belongsTo(PaymentStatus, {
  foreignKey: "status",
  targetKey: "code",
  as: "status_detail",
  constraints: false,
});
Payment.belongsTo(Image, {
  foreignKey: "reference_image_id",
  as: "reference_image",
  constraints: false,
});
Payment.hasMany(PaymentStatusHistory, {
  foreignKey: "payment_id",
  as: "history",
});
Payment.belongsTo(User, {
  foreignKey: "created_by_user_id",
  as: "created_by",
});
User.hasMany(Payment, {
  foreignKey: "created_by_user_id",
  as: "created_payments",
});

module.exports = Payment;
