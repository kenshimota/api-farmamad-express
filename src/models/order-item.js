const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Order = require("./order");
const Product = require("./product");
const ItemState = require("./item-state");
const Tax = require("./tax");

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
    tax_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tax_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    tax_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
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

OrderItem.belongsTo(Tax, { foreignKey: "tax_id", as: "tax" });
Tax.hasMany(OrderItem, { foreignKey: "tax_id", as: "order_items" });

module.exports = OrderItem;
