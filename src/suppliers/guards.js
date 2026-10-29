const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const {
  EDITABLE_SUPPLIER_FIELDS,
  REQUIRED_SUPPLIER_FIELDS,
} = require("./validators");

const WRITE_ROLES = Object.freeze(["admin", "seller"]);

/**
 * Guards the read endpoints: any authenticated user can list or inspect
 * suppliers.
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
 * @param {string[]} [fields] - Required field names; empty for partial updates.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields = REQUIRED_SUPPLIER_FIELDS) {
  return [validateRequest({ schema, fields })];
}

/**
 * Builds a middleware that requires at least one editable field after
 * validation, so a PUT request cannot send an empty payload.
 * @returns {import("express").RequestHandler} The middleware.
 */
function requireAnyField() {
  return (req, res, next) => {
    const present = EDITABLE_SUPPLIER_FIELDS.some(
      (field) => req.validated[field] !== undefined,
    );

    if (!present) {
      return res
        .status(400)
        .json({ message: "At least one field is required" });
    }

    return next();
  };
}

module.exports = {
  WRITE_ROLES,
  readAccess,
  requireAnyField,
  validatedBody,
  writeAccess,
};
