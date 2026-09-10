const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents an application role.
 * The role catalog is seeded in the `roles` table, never hard-coded as a
 * Postgres ENUM.
 */
const Role = sequelize.define(
  "Role",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "roles",
  },
);

module.exports = Role;
