/**
 * Extracts the role name from a user whose `role` may be either an included
 * Role model or a plain string.
 * @param {object} user - User instance or plain object.
 * @returns {string|undefined} The role name when available.
 */
function getRoleName(user) {
  if (!user || !user.role) {
    return undefined;
  }

  return typeof user.role === "string" ? user.role : user.role.name;
}

/**
 * Builds the public representation of a user, excluding the password hash and
 * the internal roleId while exposing the role name.
 * @param {object} user - User instance or plain object.
 * @param {string} [roleName] - Explicit role name; derived from the user when
 *   omitted.
 * @returns {{ id: number, username: string, email: string, name: string|null,
 *   role: string|undefined }} The public user data.
 */
function toPublicUser(user, roleName = getRoleName(user)) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: roleName,
  };
}

module.exports = { getRoleName, toPublicUser };
