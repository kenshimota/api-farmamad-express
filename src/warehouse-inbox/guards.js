const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");

const READ_ROLES = Object.freeze(["admin", "seller", "manager_warehouse"]);
const WRITE_ROLES = Object.freeze(["admin", "manager_warehouse"]);

/**
 * Guards the inbox reads: administrators, sellers and warehouse managers can
 * list the lots waiting for a location.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the location writes. Sellers can read but cannot claim or locate a
 * lot, and dispatchers/support/customers are rejected.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

/**
 * Validates the location body with yup and answers 400/422 following the API
 * contract.
 * @param {import("yup").Schema} schema - Location schema.
 * @param {string[]} fields - Required body fields.
 * @returns {import("express").RequestHandler} The validation middleware.
 */
function validatedBody(schema, fields) {
  return validateRequest({ schema, fields });
}

module.exports = {
  READ_ROLES,
  WRITE_ROLES,
  readAccess,
  validatedBody,
  writeAccess,
};
