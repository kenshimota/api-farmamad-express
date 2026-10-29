const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Currency = require("./currency");

/**
 * Sequelize model that represents a category of payment methods (PayPal,
 * Binance, bank transfer, mobile payment, etc.). Each type owns exactly one
 * currency, inherited by its concrete methods, and a JSONB definition of the
 * fields those methods must provide. `code` is the stable key and is unique
 * ignoring case through the functional index of the migration. Serialization
 * belongs to the method-payment-types module, so the model stays free of
 * presentation concerns.
 */
const MethodPaymentType = sequelize.define(
  "MethodPaymentType",
  {
    code: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    currency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fields: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "method_payment_types",
  },
);

MethodPaymentType.belongsTo(Currency, {
  foreignKey: "currency_id",
  as: "currency",
});
Currency.hasMany(MethodPaymentType, {
  foreignKey: "currency_id",
  as: "method_payment_types",
});

module.exports = MethodPaymentType;
