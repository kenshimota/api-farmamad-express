const { toPublicCustomer } = require("../customers/serializer");

/**
 * Extracts the role name from a user whose `role` may be either an included
 * Role model or a plain string.
 * @param {object} user - User instance or plain object.
 * @returns {string|undefined} The role name when available.
 */
function getRoleName(user) {
  if (!user) {
    return undefined;
  }

  const role = typeof user.get === "function" ? user.get("role") : user.role;

  if (!role) {
    return undefined;
  }

  return typeof role === "string" ? role : role.name;
}

/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} record - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(record, field) {
  return typeof record.get === "function" ? record.get(field) : record[field];
}

/**
 * Builds the public representation of a user, excluding the password hash and
 * the internal roleId while exposing the role name.
 * @param {object} user - User instance or plain object.
 * @param {string} [roleName] - Explicit role name; derived from the user when
 *   omitted.
 * @param {object} [options] - Serialization options.
 * @param {boolean} [options.includeCustomer] - When true, adds `customer_id`
 *   and the public `customer` summary (or null when the user has no link).
 * @returns {{ id: number, username: string, email: string, name: string|null,
 *   role: string|undefined, isBlocked: boolean, customer_id?: number|null,
 *   customer?: object|null }} The public user data.
 */
function toPublicUser(
  user,
  roleName = getRoleName(user),
  { includeCustomer = false } = {},
) {
  const publicUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: roleName,
    isBlocked: user.isBlocked === true,
  };

  if (!includeCustomer) {
    return publicUser;
  }

  const customer = readField(user, "customer");
  const customerId = readField(user, "customer_id");

  publicUser.customer_id =
    customerId ?? (customer ? readField(customer, "id") : null);
  publicUser.customer = customer ? toPublicCustomer(customer) : null;

  return publicUser;
}

module.exports = { getRoleName, readField, toPublicUser };
