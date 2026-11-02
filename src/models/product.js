const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Category = require("./category");
const Image = require("./image");
const Tax = require("./tax");

/**
 * Sequelize model that represents a product in the catalog. It belongs to one
 * category, one image and one tax; every foreign key is required. Serialization
 * belongs to the products module, so the model stays free of presentation
 * concerns.
 */
const Product = sequelize.define(
  "Product",
  {
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    image_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tax_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "products",
  },
);

Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });
Category.hasMany(Product, { foreignKey: "category_id", as: "products" });
Product.belongsTo(Image, { foreignKey: "image_id", as: "image" });
Image.hasMany(Product, { foreignKey: "image_id", as: "products" });
Product.belongsTo(Tax, { foreignKey: "tax_id", as: "tax" });
Tax.hasMany(Product, { foreignKey: "tax_id", as: "products" });

module.exports = Product;
