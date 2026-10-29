const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_TAX_FIELDS } = require("./fields");

const READ_ROLES = Object.freeze([
  "admin",
  "seller",
  "manager_warehouse",
  "dispatcher",
]);
const WRITE_ROLES = Object.freeze(["admin"]);

/**
 * Guards the read endpoints: administrators, sellers, warehouse managers and
 * dispatchers can list taxes and inspect their detail.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the write endpoints (create, update and delete). Only administrators
 * can change the catalog.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

/**
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @param {string[]} [fields] - Required field names; empty for partial updates.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields = REQUIRED_TAX_FIELDS) {
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
  READ_ROLES,
  WRITE_ROLES,
  readAccess,
  requireAnyField,
  validatedBody,
  writeAccess,
};
