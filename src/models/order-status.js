const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents one step of the order lifecycle. `code` is
 * the stable key referenced by `orders.status` and `order_history`; `is_terminal`
 * is not stored because it is derived from `next_status_code === null`.
 * Serialization belongs to the order-statuses module, so the model stays free
 * of presentation concerns.
 */
const OrderStatus = sequelize.define(
  "OrderStatus",
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
    next_status_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    is_system: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "order_statuses",
  },
);

OrderStatus.belongsTo(OrderStatus, {
  foreignKey: "next_status_code",
  targetKey: "code",
  as: "next_status",
  constraints: false,
});
OrderStatus.hasMany(OrderStatus, {
  foreignKey: "next_status_code",
  sourceKey: "code",
  as: "previous_statuses",
  constraints: false,
});

module.exports = OrderStatus;
