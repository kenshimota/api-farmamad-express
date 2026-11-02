const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Order = require("./order");
const Product = require("./product");
const ItemState = require("./item-state");

/**
 * Sequelize model that represents one line of an order. `unit_price` and
 * `subtotal` are immutable snapshots taken when the order is created, in the
 * order currency, and are never recalculated from the current cost. The
 * combination `(order_id, product_id, item_state_id)` is unique at the
 * database level. Serialization belongs to the orders module.
 */
const OrderItem = sequelize.define(
  "OrderItem",
  {
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    tableName: "order_items",
  },
);

Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

Product.hasMany(OrderItem, { foreignKey: "product_id", as: "order_items" });
OrderItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });

ItemState.hasMany(OrderItem, {
  foreignKey: "item_state_id",
  as: "order_items",
});
OrderItem.belongsTo(ItemState, {
  foreignKey: "item_state_id",
  as: "item_state",
});

module.exports = OrderItem;
