const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");

const CREATE_ROLES = Object.freeze(["customer"]);

/**
 * Guards `POST /orders`: only authenticated customers with a linked profile
 * can create orders. The service enforces the profile link itself.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function createAccess() {
  return [authenticate, authorize(...CREATE_ROLES)];
}

module.exports = { CREATE_ROLES, createAccess };
