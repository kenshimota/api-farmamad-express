const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a product category. The name is required
 * and unique, and it is stored trimmed by the categories module validators.
 * Serialization belongs to the categories module, so the model stays free of
 * presentation concerns.
 */
const Category = sequelize.define(
  "Category",
  {
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "categories",
  },
);

module.exports = Category;
