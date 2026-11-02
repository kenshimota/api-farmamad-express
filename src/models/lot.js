const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Product = require("./product");
const ItemState = require("./item-state");
const Warehouse = require("./warehouse");
const Shelf = require("./shelf");
const ShelfSection = require("./shelf-section");
const User = require("./user");

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
      allowNull: true,
    },
    shelf_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    location_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "located",
    },
    location_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    location_started_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    located_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    located_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "lots",
    hooks: {
      beforeValidate(lot) {
        if (
          lot.location_status === "located" &&
          (lot.located_at === null || lot.located_at === undefined)
        ) {
          lot.located_at = new Date();
        }
      },
    },
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

Lot.belongsTo(User, { foreignKey: "location_started_by", as: "started_by" });
Lot.belongsTo(User, { foreignKey: "located_by", as: "located_by_user" });

module.exports = Lot;
