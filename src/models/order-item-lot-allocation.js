const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const OrderItem = require("./order-item");
const Lot = require("./lot");

/**
 * Sequelize model that records which physical lots were reserved for an order
 * line and in what quantity. Only rows with `status = 'reserved'` count as an
 * active reservation; `lots.reserved` is the sum of them and is maintained in
 * the same transaction. The pair `(order_item_id, lot_id)` is unique. This
 * model is internal and is never exposed by the API.
 */
const OrderItemLotAllocation = sequelize.define(
  "OrderItemLotAllocation",
  {
    order_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lot_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "reserved",
    },
  },
  {
    tableName: "order_item_lot_allocations",
  },
);

OrderItem.hasMany(OrderItemLotAllocation, {
  foreignKey: "order_item_id",
  as: "allocations",
});
OrderItemLotAllocation.belongsTo(OrderItem, {
  foreignKey: "order_item_id",
  as: "order_item",
});

Lot.hasMany(OrderItemLotAllocation, {
  foreignKey: "lot_id",
  as: "order_item_lot_allocations",
});
OrderItemLotAllocation.belongsTo(Lot, {
  foreignKey: "lot_id",
  as: "lot",
});

module.exports = OrderItemLotAllocation;
