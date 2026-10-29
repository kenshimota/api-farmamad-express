const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const City = require("./city");
const State = require("./state");

/**
 * Sequelize model that represents a supplier. It belongs to one city and one
 * state; both foreign keys are required and restrict deletion. The
 * identification is unique ignoring case at the database level through a
 * functional index, and the module validators store it uppercase.
 * Serialization belongs to the suppliers module, so the model stays free of
 * presentation concerns.
 */
const Supplier = sequelize.define(
  "Supplier",
  {
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    identification: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    observations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    city_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "suppliers",
  },
);

Supplier.belongsTo(City, { foreignKey: "city_id", as: "city" });
City.hasMany(Supplier, { foreignKey: "city_id", as: "suppliers" });
Supplier.belongsTo(State, { foreignKey: "state_id", as: "state" });
State.hasMany(Supplier, { foreignKey: "state_id", as: "suppliers" });

module.exports = Supplier;
