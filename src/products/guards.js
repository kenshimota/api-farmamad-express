const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_PRODUCT_FIELDS } = require("./validators");

const WRITE_ROLES = Object.freeze(["admin", "seller"]);

/**
 * Guards the read endpoints: any authenticated user can list or inspect
 * products.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate];
}

/**
 * Guards the write endpoints (create, update and delete).
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

/**
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema) {
  return [validateRequest({ schema, fields: REQUIRED_PRODUCT_FIELDS })];
}

module.exports = {
  WRITE_ROLES,
  readAccess,
  validatedBody,
  writeAccess,
};
