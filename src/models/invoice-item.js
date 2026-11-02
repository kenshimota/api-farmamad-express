const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Invoice = require("./invoice");
const Product = require("./product");
const ItemState = require("./item-state");

/**
 * Sequelize model that represents one immutable invoice line. Product name,
 * reference and item state name are snapshots taken when the invoice is
 * issued, so later catalog edits never change a past invoice. `order_item_id`
 * stays nullable until `order_items` exists (#58); the unique
 * `(invoice_id, order_item_id)` pair still prevents duplicating an order line.
 */
const InvoiceItem = sequelize.define(
  "InvoiceItem",
  {
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    product_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    product_reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    item_state_name: {
      type: DataTypes.STRING(50),
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
    tableName: "invoice_items",
  },
);

Invoice.hasMany(InvoiceItem, { foreignKey: "invoice_id", as: "items" });
InvoiceItem.belongsTo(Invoice, { foreignKey: "invoice_id", as: "invoice" });

Product.hasMany(InvoiceItem, {
  foreignKey: "product_id",
  as: "invoice_items",
});
InvoiceItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });

ItemState.hasMany(InvoiceItem, {
  foreignKey: "item_state_id",
  as: "invoice_items",
});
InvoiceItem.belongsTo(ItemState, {
  foreignKey: "item_state_id",
  as: "item_state",
});

module.exports = InvoiceItem;
