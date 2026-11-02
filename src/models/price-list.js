const { DataTypes, Model } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");

/**
 * Sequelize model that represents a price list: a named margin percentage that
 * is applied over the real cost of a product to calculate the price a customer
 * pays. `percentage` is a margin over the cost, not a discount over a sale
 * price, and must stay in the `[0, 100)` range. The database also enforces the
 * range and the case-insensitive unique name. Serialization belongs to the
 * price-lists module, so the model stays free of presentation concerns.
 */
const PriceList = sequelize.define(
  "PriceList",
  {
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
  },
  {
    tableName: "price_lists",
  },
);

// Unit tests replace the customer model with a plain double; only register the
// associations when the real Sequelize model is loaded.
if (Customer.prototype instanceof Model) {
  PriceList.hasMany(Customer, {
    foreignKey: "price_list_id",
    as: "customers",
  });
  Customer.belongsTo(PriceList, {
    foreignKey: "price_list_id",
    as: "price_list",
  });
}

module.exports = PriceList;
