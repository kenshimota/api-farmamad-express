const { DataTypes } = require("sequelize");
const sequelize = require("../database");

/**
 * Sequelize model that stores one-time password recovery codes.
 * Only the bcrypt hash of the 8-digit code is persisted; the plain code is
 * never stored.
 */
const PasswordResetCode = sequelize.define(
  "PasswordResetCode",
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    codeHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    consumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "password_reset_codes",
  },
);

module.exports = PasswordResetCode;
