const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");
const User = require("./user");

/**
 * Sequelize model that represents the assignment of a customer to the seller
 * responsible for that customer. The table is a bridge so the relationship can
 * evolve to multiple sellers in the future; today `customer_id` is unique.
 * Serialization belongs to the customer-sellers module, so the model stays free
 * of presentation concerns.
 */
const CustomerSeller = sequelize.define(
  "CustomerSeller",
  {
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    seller_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "customer_sellers",
  },
);

CustomerSeller.belongsTo(Customer, {
  foreignKey: "customer_id",
  as: "customer",
});
Customer.hasOne(CustomerSeller, {
  foreignKey: "customer_id",
  as: "sellerAssignment",
});

CustomerSeller.belongsTo(User, {
  foreignKey: "seller_id",
  as: "seller",
});
User.hasMany(CustomerSeller, {
  foreignKey: "seller_id",
  as: "customerAssignments",
});

module.exports = CustomerSeller;
