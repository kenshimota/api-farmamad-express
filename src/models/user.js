const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const { hashPassword } = require("../auth/password");
const Role = require("./role");
const PasswordResetCode = require("./password-reset-code");

/**
 * Sequelize model that represents an application user.
 * The password is always persisted as a bcrypt hash.
 */
const User = sequelize.define(
  "User",
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "users",
    hooks: {
      beforeCreate: async (user) => {
        user.password = await hashPassword(user.password);
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await hashPassword(user.password);
        }
      },
    },
  },
);

User.belongsTo(Role, { foreignKey: "roleId", as: "role" });
Role.hasMany(User, { foreignKey: "roleId", as: "users" });

User.hasMany(PasswordResetCode, {
  foreignKey: "userId",
  as: "passwordResetCodes",
});
PasswordResetCode.belongsTo(User, { foreignKey: "userId", as: "user" });

/**
 * Serializes the user without the password hash or the internal role id,
 * exposing the role name instead.
 * @returns {object} The user values without the password and roleId.
 */
User.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  const role = this.get("role");

  delete values.password;
  delete values.roleId;

  if (role) {
    values.role = role.name;
  }

  return values;
};

module.exports = User;
