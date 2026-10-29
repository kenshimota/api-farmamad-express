const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const State = require("./state");

/**
 * Sequelize model that represents a city belonging to a state. The pair
 * (name, state_id) is unique, so the same name can exist in different states
 * but never twice in the same one. The state foreign key restricts deletion.
 * Serialization belongs to the cities module, so the model stays free of
 * presentation concerns.
 */
const City = sequelize.define(
  "City",
  {
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "cities",
  },
);

City.belongsTo(State, { foreignKey: "state_id", as: "state" });
State.hasMany(City, { foreignKey: "state_id", as: "cities" });

module.exports = City;
