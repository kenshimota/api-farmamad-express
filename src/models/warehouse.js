const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a physical warehouse. The name is not
 * unique on purpose: two warehouses can share a commercial name, and the
 * observations are optional free text. Serialization belongs to the
 * warehouses module, so the model stays free of presentation concerns.
 */
const Warehouse = sequelize.define(
  "Warehouse",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "warehouses",
  },
);

module.exports = Warehouse;
