const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const READ_ROLES = Object.freeze(["admin", "seller"]);
const DETAIL_ROLES = Object.freeze(["admin", "seller", "customer"]);

/**
 * Guards the invoice listing: only administrators and sellers can see every
 * invoice.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the invoice detail. Customers are included here and the service
 * enforces that they can only read their own invoices.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function detailAccess() {
  return [authenticate, authorize(...DETAIL_ROLES)];
}

module.exports = {
  DETAIL_ROLES,
  READ_ROLES,
  detailAccess,
  readAccess,
};
