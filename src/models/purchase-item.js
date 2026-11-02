const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Purchase = require("./purchase");
const Product = require("./product");
const ItemState = require("./item-state");
const Lot = require("./lot");

/**
 * Sequelize model that represents one line of a purchase. `unit_cost` is the
 * historical cost agreed in that purchase and never changes when `costs` is
 * updated later. Every line carries its own `lot_number` and
 * `expiration_date`; `(purchase_id, product_id, LOWER(lot_number))` is unique
 * while the lot is present, and `received_lot_id` points to the lot created or
 * reused on confirmation. The purchase cascades on delete while product, item
 * state and received lot restrict deletion. Serialization belongs to the
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
    tax_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    lot_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiration_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    received_lot_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
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

PurchaseItem.belongsTo(Lot, {
  foreignKey: "received_lot_id",
  as: "received_lot",
});
Lot.hasMany(PurchaseItem, {
  foreignKey: "received_lot_id",
  as: "purchase_items",
});

module.exports = PurchaseItem;
