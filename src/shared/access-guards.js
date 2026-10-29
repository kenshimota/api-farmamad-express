const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");

const READ_ROLES = Object.freeze(["admin", "seller", "dispatcher"]);
const WRITE_ROLES = Object.freeze(["admin"]);

/**
 * Builds the Express middleware chain shared by a resource router: authenticated
 * reads for the catalog roles, administrator-only writes and body validation
 * with the module's default required fields.
 * @param {object} options - Module configuration.
 * @param {ReadonlyArray<string>} options.requiredFields - Fields required by the
 *   create schema when no override is given.
 * @param {ReadonlyArray<string>} [options.readRoles] - Roles allowed to read.
 * @param {ReadonlyArray<string>} [options.writeRoles] - Roles allowed to write.
 * @returns {object} The middleware factories of the module.
 */
function createAccessGuards({
  requiredFields,
  readRoles = READ_ROLES,
  writeRoles = WRITE_ROLES,
}) {
  /**
   * Guards the read endpoints.
   * @returns {import("express").RequestHandler[]} The middleware chain.
   */
  function readAccess() {
    return [authenticate, authorize(...readRoles)];
  }

  /**
   * Guards the write endpoints (create, update and delete).
   * @returns {import("express").RequestHandler[]} The middleware chain.
   */
  function writeAccess() {
    return [authenticate, authorize(...writeRoles)];
  }

  /**
   * Composes the body validation chain for a schema.
   * @param {import("yup").Schema} schema - Schema with the format rules.
   * @param {string[]} [fields] - Required field names; empty for updates.
   * @returns {import("express").RequestHandler[]} The middleware chain.
   */
  function validatedBody(schema, fields = requiredFields) {
    return [validateRequest({ schema, fields })];
  }

  /**
   * Requires at least one of the given fields after validation, so a PUT
   * request cannot send an empty payload.
   * @param {string[]} fields - Accepted field names.
   * @param {string} message - 400 message when none is present.
   * @returns {import("express").RequestHandler} The middleware.
   */
  function requireAnyField(fields, message) {
    return (req, res, next) => {
      const present = fields.some(
        (field) => req.validated[field] !== undefined,
      );

      if (!present) {
        return res.status(400).json({ message });
      }

      return next();
    };
  }

  return { readAccess, requireAnyField, validatedBody, writeAccess };
}

module.exports = {
  READ_ROLES,
  WRITE_ROLES,
  createAccessGuards,
};
