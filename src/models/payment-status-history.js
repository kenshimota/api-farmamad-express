const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const PaymentStatus = require("./payment-status");
const User = require("./user");

/**
 * Sequelize model that represents one append-only event of the payment
 * reconciliation history. Each status change inserts exactly one row with the
 * previous and next status, the optional reason, the authenticated actor and
 * the audit timestamps. There are no API endpoints to edit or delete events.
 */
const PaymentStatusHistory = sequelize.define(
  "PaymentStatusHistory",
  {
    payment_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    from_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    to_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "payment_status_history",
  },
);

PaymentStatusHistory.belongsTo(PaymentStatus, {
  foreignKey: "from_status",
  targetKey: "code",
  as: "from_status_detail",
  constraints: false,
});
PaymentStatusHistory.belongsTo(PaymentStatus, {
  foreignKey: "to_status",
  targetKey: "code",
  as: "to_status_detail",
  constraints: false,
});
PaymentStatusHistory.belongsTo(User, {
  foreignKey: "actor_user_id",
  as: "actor",
  constraints: false,
});

module.exports = PaymentStatusHistory;
