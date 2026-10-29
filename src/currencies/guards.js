const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_CURRENCY_FIELDS } = require("./validators");

const READ_ROLES = Object.freeze([
  "admin",
  "seller",
  "manager_warehouse",
  "dispatcher",
]);
const ADMIN_ROLES = Object.freeze(["admin"]);
const WRITE_ROLES = ADMIN_ROLES;

/**
 * Guards the read endpoints: administrators, sellers, warehouse managers and
 * dispatchers can list currencies and inspect their history.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the write endpoints (create, update and deactivate). Only
 * administrators can change the catalog.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

/**
 * Tells whether the authenticated user is an administrator.
 * @param {object} [user] - Authenticated token payload.
 * @returns {boolean} True for administrators.
 */
function isAdmin(user) {
  return user !== undefined && ADMIN_ROLES.includes(user.role);
}

/**
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @param {string[]} [fields] - Required field names; empty for partial updates.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields = REQUIRED_CURRENCY_FIELDS) {
  return [validateRequest({ schema, fields })];
}

/**
 * Builds a middleware that requires at least one of the given fields after
 * validation, so a PUT request cannot send an empty payload.
 * @param {string[]} fields - Accepted field names.
 * @param {string} message - 400 message when none is present.
 * @returns {import("express").RequestHandler} The middleware.
 */
function requireAnyField(fields, message) {
  return (req, res, next) => {
    const present = fields.some((field) => req.validated[field] !== undefined);

    if (!present) {
      return res.status(400).json({ message });
    }

    return next();
  };
}

module.exports = {
  ADMIN_ROLES,
  READ_ROLES,
  WRITE_ROLES,
  isAdmin,
  readAccess,
  requireAnyField,
  validatedBody,
  writeAccess,
};
