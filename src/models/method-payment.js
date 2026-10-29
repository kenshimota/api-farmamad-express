const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const MethodPaymentType = require("./method-payment-type");

/**
 * Sequelize model that represents one concrete payment method (a PayPal
 * account, a Binance wallet, a bank account or a mobile payment) belonging to
 * a method payment type. The currency is not stored here: it is inherited from
 * the type through the `method_payment_type` association, whose own `currency`
 * association provides the nested currency. `details` is a plain JSONB object
 * validated by the method-payments module against the type `fields`. The
 * database enforces the RESTRICT foreign key and the case-insensitive unique
 * label per type. Serialization belongs to the method-payments module, so the
 * model stays free of presentation concerns.
 */
const MethodPayment = sequelize.define(
  "MethodPayment",
  {
    method_payment_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "method_payments",
  },
);

MethodPayment.belongsTo(MethodPaymentType, {
  foreignKey: "method_payment_type_id",
  as: "method_payment_type",
});
MethodPaymentType.hasMany(MethodPayment, {
  foreignKey: "method_payment_type_id",
  as: "method_payments",
});

module.exports = MethodPayment;
