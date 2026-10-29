const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a tax rate of the catalog (IVA, IGTF, etc.).
 * `code` is the stable key and is unique ignoring case through the functional
 * index of the migration; `rate` is a percentage stored as DECIMAL(5,2) and
 * limited to 0..100 by a database CHECK. `is_active` hides a tax from future
 * selections without deleting it. Serialization belongs to the taxes module,
 * so the model stays free of presentation concerns.
 */
const Tax = sequelize.define(
  "Tax",
  {
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "taxes",
  },
);

module.exports = Tax;
