const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");
const User = require("./user");
const Currency = require("./currency");
const PaymentTerm = require("./payment-term");

/**
 * Sequelize model that represents a customer order. The server assigns the
 * ascending `number` from `orders_number_seq` and owns every monetary and
 * status field; clients can never set them. The status is a STRING with a
 * database CHECK so it can evolve without a PostgreSQL ENUM migration.
 * Serialization belongs to the orders module, so the model stays free of
 * presentation concerns.
 */
const Order = sequelize.define(
  "Order",
  {
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "draft",
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    delivery_address: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    payment_term_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "orders",
  },
);

Order.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Customer.hasMany(Order, { foreignKey: "customer_id", as: "orders" });

Order.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Order, { foreignKey: "user_id", as: "orders" });

Order.belongsTo(Currency, { foreignKey: "currency_id", as: "currency" });
Currency.hasMany(Order, { foreignKey: "currency_id", as: "orders" });

Order.belongsTo(PaymentTerm, {
  foreignKey: "payment_term_id",
  as: "payment_term",
});
PaymentTerm.hasMany(Order, {
  foreignKey: "payment_term_id",
  as: "orders",
});

module.exports = Order;
