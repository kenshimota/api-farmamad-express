const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a payment term (cash, credit 10 days, credit
 * 15 days or a custom number of days). `code` is the stable key and is unique
 * ignoring case through the functional index of the migration; `days = 0`
 * means cash and `days > 0` means credit. Inactive terms stay in the catalog
 * but cannot be assigned to new customers, orders or invoices. Serialization
 * belongs to the payment-terms module, so the model stays free of presentation
 * concerns.
 */
const PaymentTerm = sequelize.define(
  "PaymentTerm",
  {
    code: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    days: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "payment_terms",
  },
);

module.exports = PaymentTerm;
