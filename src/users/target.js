const User = require("../models/user");
const Role = require("../models/role");

/**
 * Loads a user and locks its row for the duration of the transaction. The role
 * is loaded in a separate query because Postgres rejects `FOR UPDATE` on the
 * nullable side of the outer join Sequelize builds for includes.
 * @param {number} id - User primary key.
 * @param {object} options - Query options.
 * @param {import("sequelize").Transaction} options.transaction - Transaction
 *   that keeps the guard checks and the following write race free.
 * @returns {Promise<object|null>} The locked user with its role attached, or
 *   null when the user does not exist.
 */
async function findUserForUpdate(id, { transaction }) {
  const user = await User.findByPk(id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!user) {
    return null;
  }

  const role = await Role.findByPk(user.roleId, { transaction });

  user.setDataValue("role", role);

  return user;
}

module.exports = { findUserForUpdate };
