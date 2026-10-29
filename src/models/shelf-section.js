const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const { shelfAttributes } = require("./shelf-attributes");
const Shelf = require("./shelf");

/**
 * Sequelize model that represents a section inside a shelf. The code is unique
 * per shelf ignoring case, the section cannot be moved to another shelf and the
 * database removes it in cascade when its parent shelf is deleted. It declares
 * the `Shelf.hasMany` association as `sections` so the shelves module can load
 * the hierarchy with a single Sequelize include.
 */
const ShelfSection = sequelize.define(
  "ShelfSection",
  {
    shelf_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ...shelfAttributes(),
  },
  {
    tableName: "shelf_sections",
  },
);

Shelf.hasMany(ShelfSection, {
  foreignKey: "shelf_id",
  as: "sections",
  order: [["code", "ASC"]],
});
ShelfSection.belongsTo(Shelf, {
  foreignKey: "shelf_id",
  as: "shelf",
});

module.exports = ShelfSection;
