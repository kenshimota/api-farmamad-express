const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a reusable product image. `url`,
 * `reference` and `thumbnail` are required; `pathname` is optional because an
 * image may live only in S3. References are unique and stored trimmed by the
 * images module validators. Serialization belongs to the images module, so the
 * model stays free of presentation concerns.
 */
const Image = sequelize.define(
  "Image",
  {
    url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    pathname: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      defaultValue: null,
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    thumbnail: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
  },
  {
    tableName: "images",
  },
);

module.exports = Image;
