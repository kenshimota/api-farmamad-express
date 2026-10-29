const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Supplier = require("./supplier");
const Currency = require("./currency");

/**
 * Sequelize model that represents a purchase order. The server assigns the
 * ascending `number` from the `purchases_number_seq` sequence and owns the
 * totals; clients can never set them. The status is a STRING with a database
 * CHECK (`draft`, `confirmed`, `cancelled`) instead of a PostgreSQL ENUM so it
 * can evolve without a type migration. Serialization belongs to the purchases
 * module, so the model stays free of presentation concerns.
 */
const Purchase = sequelize.define(
  "Purchase",
  {
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    supplier_id: {
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
      defaultValue: 0,
    },
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 16,
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
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "purchases",
  },
);

Purchase.belongsTo(Supplier, { foreignKey: "supplier_id", as: "supplier" });
Supplier.hasMany(Purchase, { foreignKey: "supplier_id", as: "purchases" });
Purchase.belongsTo(Currency, { foreignKey: "currency_id", as: "currency" });
Currency.hasMany(Purchase, { foreignKey: "currency_id", as: "purchases" });

module.exports = Purchase;
