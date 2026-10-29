const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Product = require("./product");
const ItemState = require("./item-state");

/**
 * Sequelize model that represents the current cost of a product for a given
 * item state. The combination `(product_id, item_state_id)` is unique at the
 * database level, so a product has one current cost per state; the historical
 * values live in the purchase items. Both foreign keys are required and
 * restrict deletion. Serialization belongs to the costs module, so the model
 * stays free of presentation concerns.
 */
const Cost = sequelize.define(
  "Cost",
  {
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    tableName: "costs",
  },
);

Cost.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Product.hasMany(Cost, { foreignKey: "product_id", as: "costs" });
Cost.belongsTo(ItemState, { foreignKey: "item_state_id", as: "item_state" });
ItemState.hasMany(Cost, { foreignKey: "item_state_id", as: "costs" });

module.exports = Cost;
