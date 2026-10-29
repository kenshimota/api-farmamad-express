const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents a Venezuelan state (or Distrito Capital).
 * The name is unique without distinguishing case (enforced by a functional
 * unique index on lower(name)) and the ISO 3166-2:VE code is unique and stored
 * uppercase by the states module validators. Serialization belongs to the
 * states module, so the model stays free of presentation concerns.
 */
const State = sequelize.define(
  "State",
  {
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "states",
  },
);

module.exports = State;
