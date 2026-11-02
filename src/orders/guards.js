const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const ORDER_ROLES = Object.freeze(["customer", "admin", "seller"]);

/**
 * Guards every orders endpoint: only authenticated customers, administrators
 * and sellers can continue. The service enforces customer ownership, seller
 * assignments and the transition rules.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function orderAccess() {
  return [authenticate, authorize(...ORDER_ROLES)];
}

module.exports = { ORDER_ROLES, createAccess: orderAccess, orderAccess };
