const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Currency = require("./currency");
const User = require("./user");

/**
 * Sequelize model that represents an append-only row of the currency rate
 * history. It has no `createdAt`/`updatedAt` on purpose: `changed_at` is the
 * only timestamp and the row is immutable. `changed_by` is nullable so the
 * initial seeder data and deleted users keep their history.
 */
const CurrencyRateHistory = sequelize.define(
  "CurrencyRateHistory",
  {
    currency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previous_rate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    new_rate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
    },
    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    changed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "currency_rate_history",
    timestamps: false,
  },
);

CurrencyRateHistory.belongsTo(Currency, {
  foreignKey: "currency_id",
  as: "currency",
});
Currency.hasMany(CurrencyRateHistory, {
  foreignKey: "currency_id",
  as: "rate_history",
});

CurrencyRateHistory.belongsTo(User, {
  foreignKey: "changed_by",
  as: "changed_by_user",
});
User.hasMany(CurrencyRateHistory, {
  foreignKey: "changed_by",
  as: "currency_rate_changes",
});

module.exports = CurrencyRateHistory;
