const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_WAREHOUSE_FIELDS } = require("./validators");
const { requireWarehouseFields } = require("./shared");

const READ_ROLES = Object.freeze(["admin", "dispatcher", "manager_warehouse"]);
const WRITE_ROLES = Object.freeze(["admin", "manager_warehouse"]);

/**
 * Composes the authentication plus role authorization middleware for a set of
 * roles, preserving the documented order: authenticate first, authorize last.
 * @param {...string} roles - Roles allowed to continue.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function authorizedFor(...roles) {
  return [authenticate, authorize(...roles)];
}

/**
 * Guards the read endpoints (list and detail).
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return authorizedFor(...READ_ROLES);
}

/**
 * Guards the write endpoints (create, update and delete).
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return authorizedFor(...WRITE_ROLES);
}

/**
 * Composes the body validation chain for a schema. The presence check runs
 * before the schema so the 400 contract message wins over the 422 payload.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema) {
  return [
    requireWarehouseFields,
    validateRequest({ schema, fields: REQUIRED_WAREHOUSE_FIELDS }),
  ];
}

module.exports = {
  READ_ROLES,
  WRITE_ROLES,
  authorizedFor,
  readAccess,
  validatedBody,
  writeAccess,
};
