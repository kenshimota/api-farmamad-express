const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Order = require("./order");
const User = require("./user");

/**
 * Sequelize model that represents an append-only order event. The API only
 * reads these rows ordered by `createdAt` and `id` ascending; creation happens
 * inside the order transactions. `metadata` keeps optional JSON details such
 * as the affected product, state or invoice data. Serialization belongs to
 * the orders module.
 */
const OrderHistory = sequelize.define(
  "OrderHistory",
  {
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    event_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    from_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    to_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "order_history",
  },
);

Order.hasMany(OrderHistory, { foreignKey: "order_id", as: "history" });
OrderHistory.belongsTo(Order, { foreignKey: "order_id", as: "order" });

User.hasMany(OrderHistory, {
  foreignKey: "actor_user_id",
  as: "order_history_events",
});
OrderHistory.belongsTo(User, {
  foreignKey: "actor_user_id",
  as: "actor_user",
});

module.exports = OrderHistory;
