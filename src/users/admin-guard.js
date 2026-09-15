const User = require("../models/user");
const { ADMIN_ROLE } = require("../auth/roles");
const { getRoleName } = require("../auth/serializers");

/**
 * Checks whether a user holds the administrator role.
 * @param {object} user - User instance or plain object with a `role`.
 * @returns {boolean} True when the user is an administrator.
 */
function isAdmin(user) {
  return getRoleName(user) === ADMIN_ROLE;
}

/**
 * Checks whether an active administrator is the last one. A blocked user is
 * never considered for this guard, and non administrators short circuit before
 * hitting the database.
 * @param {object} user - Target user with `roleId`, `role` and `isBlocked`.
 * @param {object} options - Guard options.
 * @param {import("sequelize").Transaction} options.transaction - Transaction
 *   that keeps the count and the following write race free.
 * @returns {Promise<boolean>} True when blocking or deleting the user would
 *   leave the system without active administrators.
 */
async function isLastActiveAdmin(user, { transaction }) {
  if (!isAdmin(user) || user.isBlocked) {
    return false;
  }

  const activeAdmins = await User.count({
    where: { roleId: user.roleId, isBlocked: false },
    transaction,
  });

  return activeAdmins <= 1;
}

module.exports = { isAdmin, isLastActiveAdmin };
