const { DataTypes } = require("sequelize");

/**
 * Builds the attribute set shared by `shelves` and `shelf_sections`. The code
 * is the stable key of each location; name and description are optional.
 * Returning a fresh object avoids sharing Sequelize attribute instances
 * between models.
 * @returns {object} Sequelize attribute definitions for code, name and
 *   description.
 */
function shelfAttributes() {
  return {
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  };
}

module.exports = { shelfAttributes };
