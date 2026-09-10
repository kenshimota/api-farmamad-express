const Role = require("../models/role");

const DEFAULT_ROLE = "customer";
const ADMIN_ROLE = "admin";

/**
 * Finds a role by its name in the `roles` table.
 * @param {string} name - Role name.
 * @param {object} [options] - Extra Sequelize query options.
 * @returns {Promise<object|null>} The role instance or null when missing.
 */
async function findRoleByName(name, options = {}) {
  return Role.findOne({ where: { name }, ...options });
}

/**
 * Checks whether a role name exists in the `roles` table.
 * @param {string} name - Role name.
 * @returns {Promise<boolean>} True when the role exists.
 */
async function isValidRole(name) {
  return Boolean(await findRoleByName(name));
}

module.exports = { DEFAULT_ROLE, ADMIN_ROLE, findRoleByName, isValidRole };
