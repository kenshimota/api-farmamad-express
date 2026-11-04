const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const PICKING_ROLES = Object.freeze([
  "admin",
  "seller",
  "manager_warehouse",
  "dispatcher",
]);

/**
 * Guards the picking endpoint. It has its own role list because warehouse and
 * dispatch roles must read the physical location without gaining access to the
 * other order endpoints.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function pickingAccess() {
  return [authenticate, authorize(...PICKING_ROLES)];
}

module.exports = { PICKING_ROLES, pickingAccess };
