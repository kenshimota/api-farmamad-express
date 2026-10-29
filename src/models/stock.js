const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Product = require("./product");
const ItemState = require("./item-state");
const Cost = require("./cost");

/**
 * Sequelize model that represents the available units of a product for a
 * given item state. The combination `(product_id, item_state_id)` is unique at
 * the database level and `quantity` can never be negative. The row is created
 * and incremented only by the purchase confirmation flow (HU-21); public
 * serialization belongs to the stocks module.
 */
const Stock = sequelize.define(
  "Stock",
  {
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
      defaultValue: 0,
    },
  },
  {
    tableName: "stocks",
  },
);

Stock.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Product.hasMany(Stock, { foreignKey: "product_id", as: "stocks" });
Stock.belongsTo(ItemState, { foreignKey: "item_state_id", as: "item_state" });
ItemState.hasMany(Stock, { foreignKey: "item_state_id", as: "stocks" });
// Optional association used by the available view to join the current cost of
// the same product and item state in a single query. The repository adds the
// exact item_state_id condition to the join.
Stock.hasOne(Cost, {
  foreignKey: "product_id",
  sourceKey: "product_id",
  as: "cost",
  constraints: false,
});

module.exports = Stock;
