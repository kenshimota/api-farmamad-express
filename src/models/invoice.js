const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Customer = require("./customer");
const Currency = require("./currency");
const User = require("./user");

/**
 * Sequelize model that represents an immutable invoice header. The server
 * assigns `number` from `invoices_number_seq`, copies the monetary snapshot
 * from the order and keeps `paid_amount`/`payment_status` for the future
 * payments module. `order_id` and `payment_term_id` stay nullable until the
 * orders (#58/#63) and payment terms (#65) tables exist; the migration
 * documents the foreign keys to add later. Serialization belongs to the
 * invoices module, so the model stays free of presentation concerns.
 */
const Invoice = sequelize.define(
  "Invoice",
  {
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    invoiced_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    payment_term_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paid_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    payment_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    issued_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "invoices",
  },
);

Invoice.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Customer.hasMany(Invoice, { foreignKey: "customer_id", as: "invoices" });

Invoice.belongsTo(User, {
  foreignKey: "invoiced_by_user_id",
  as: "invoiced_by",
});
User.hasMany(Invoice, {
  foreignKey: "invoiced_by_user_id",
  as: "issued_invoices",
});

Invoice.belongsTo(Currency, { foreignKey: "currency_id", as: "currency" });
Currency.hasMany(Invoice, { foreignKey: "currency_id", as: "invoices" });

module.exports = Invoice;
