const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents one status of the payment reconciliation
 * catalog. `code` is the stable key referenced by `payments.status` and
 * `payment_status_history`; the three base codes are seeded and marked as
 * system rows, so they cannot be removed through the API.
 */
const PaymentStatus = sequelize.define(
  "PaymentStatus",
  {
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_system: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "payment_statuses",
  },
);

module.exports = PaymentStatus;
