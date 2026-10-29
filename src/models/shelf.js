const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const { shelfAttributes } = require("./shelf-attributes");
const Warehouse = require("./warehouse");

/**
 * Sequelize model that represents a physical shelf inside a warehouse. The
 * code is unique per warehouse ignoring case, and the warehouse cannot be
 * changed after creation because moving a shelf could invalidate the location
 * of existing lots. Serialization belongs to the shelves module, so the model
 * stays free of presentation concerns.
 */
const Shelf = sequelize.define(
  "Shelf",
  {
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ...shelfAttributes(),
  },
  {
    tableName: "shelves",
  },
);

Shelf.belongsTo(Warehouse, {
  foreignKey: "warehouse_id",
  as: "warehouse",
});
Warehouse.hasMany(Shelf, {
  foreignKey: "warehouse_id",
  as: "shelves",
});

module.exports = Shelf;

// Load the child model so importing Shelf alone still registers the
// `sections` association; shelf-section declares the inverse edge.
require("./shelf-section");
