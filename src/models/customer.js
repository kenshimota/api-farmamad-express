const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const { toPublicCustomer } = require("../customers/serializer");

/**
 * Sequelize model that represents a Bread King customer. A customer is a third
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

module.exports = Customer;
