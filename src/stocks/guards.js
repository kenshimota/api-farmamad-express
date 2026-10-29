const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const READ_ROLES = Object.freeze(["admin", "seller", "manager_warehouse"]);

/**
 * Guards every stock endpoint: administrators, sellers and warehouse managers
 * can read the inventory. There are no public write endpoints in this module.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

module.exports = { READ_ROLES, readAccess };
