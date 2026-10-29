const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Purchase = require("./purchase");
const Product = require("./product");
const ItemState = require("./item-state");

/**
 * Sequelize model that represents one line of a purchase. `unit_cost` is the
 * historical cost agreed in that purchase and never changes when `costs` is
 * updated later. The combination `(purchase_id, product_id, item_state_id)` is
 * unique at the database level, the purchase cascades on delete and the
 * product/item state restrict deletion. Serialization belongs to the
 * purchases module.
 */
const PurchaseItem = sequelize.define(
  "PurchaseItem",
  {
    purchase_id: {
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
    unit_cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    tableName: "purchase_items",
  },
);

Purchase.hasMany(PurchaseItem, { foreignKey: "purchase_id", as: "items" });
PurchaseItem.belongsTo(Purchase, { foreignKey: "purchase_id", as: "purchase" });

Product.hasMany(PurchaseItem, {
  foreignKey: "product_id",
  as: "purchase_items",
});
PurchaseItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });

ItemState.hasMany(PurchaseItem, {
  foreignKey: "item_state_id",
  as: "purchase_items",
});
PurchaseItem.belongsTo(ItemState, {
  foreignKey: "item_state_id",
  as: "item_state",
});

module.exports = PurchaseItem;
