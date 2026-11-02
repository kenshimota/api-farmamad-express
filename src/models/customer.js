const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const { toPublicCustomer } = require("../customers/serializer");
const PaymentTerm = require("./payment-term");

/**
 * Sequelize model that represents a Super King customer. A customer is a third
 * party that receives orders, not a system user that starts a session.
 */
const Customer = sequelize.define(
  "Customer",
  {
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    direction: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    isRegistered: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    price_list_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payment_term_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "customers",
  },
);

/**
 * Serializes the customer with only the public fields, converting the DECIMAL
 * coordinates into JSON numbers with their original precision.
 * @returns {object} The public customer data.
 */
Customer.prototype.toJSON = function toJSON() {
  return toPublicCustomer(this);
};

Customer.belongsTo(PaymentTerm, {
  foreignKey: "payment_term_id",
  as: "payment_term",
});
PaymentTerm.hasMany(Customer, {
  foreignKey: "payment_term_id",
  as: "customers",
});

module.exports = Customer;

// Registers the `Customer.belongsTo(PriceList)` association declared by the
// price-list model once both modules are fully loaded.
require("./price-list");
// Load the User model so the inverse `Customer.hasOne(User)` association is
// registered even when only the customer model is required. The association
// itself is declared in user.js to avoid a circular definition.
require("./user");
