const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a currency accepted by the system. `rate`
 * is the amount of VES that one unit of the currency is worth, so the base
 * currency (VES) always stores `1`. The database enforces the positive rate,
 * the case-insensitive unique code and the single base row through the
 * migration indexes. Serialization belongs to the currencies module, so the
 * model stays free of presentation concerns.
 */
const Currency = sequelize.define(
  "Currency",
  {
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    rate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
    },
    is_base: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "currencies",
  },
);

module.exports = Currency;
