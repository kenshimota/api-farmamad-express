const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const READ_ROLES = Object.freeze(["customer", "admin", "seller"]);
const WRITE_ROLES = Object.freeze(["admin"]);

/**
 * Guards the status catalog reads: any authenticated customer, admin or seller.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the status catalog writes: administrators only.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

module.exports = { READ_ROLES, WRITE_ROLES, readAccess, writeAccess };
