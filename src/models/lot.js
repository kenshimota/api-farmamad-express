const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Product = require("./product");
const ItemState = require("./item-state");
const Warehouse = require("./warehouse");
const Shelf = require("./shelf");
const ShelfSection = require("./shelf-section");

/**
 * Sequelize model that represents a physical lot of a product: its lot number,
 * expiration date, item state, stock/reserved quantities and physical location
 * inside a warehouse, shelf and section. `available` is a calculated field and
 * is never stored. Serialization belongs to the lots module, so the model stays
 * free of presentation concerns.
 */
const Lot = sequelize.define(
  "Lot",
  {
    number: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    expiration_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    item_state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reserved: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shelf_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "lots",
  },
);

// Each relation is declared once and wired in both directions, so the list of
// parents stays the single source of truth.
const ASSOCIATIONS = Object.freeze([
  { model: Product, as: "product", foreignKey: "product_id" },
  { model: ItemState, as: "item_state", foreignKey: "item_state_id" },
  { model: Warehouse, as: "warehouse", foreignKey: "warehouse_id" },
  { model: Shelf, as: "shelf", foreignKey: "shelf_id" },
  { model: ShelfSection, as: "section", foreignKey: "section_id" },
]);

for (const { model, as, foreignKey } of ASSOCIATIONS) {
  Lot.belongsTo(model, { foreignKey, as });
  model.hasMany(Lot, { foreignKey, as: "lots" });
}

module.exports = Lot;
