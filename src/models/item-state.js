const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that represents the state in which a product can be found
 * (sellable, damaged, expired, etc.). The name is the stable snake_case key
 * used by future modules and is unique without distinguishing case (enforced
 * by a functional unique index on lower(name)). The model stays free of
 * presentation concerns; serialization belongs to the item-states module.
 */
const ItemState = sequelize.define(
  "ItemState",
  {
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_sellable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "item_states",
  },
);

module.exports = ItemState;
