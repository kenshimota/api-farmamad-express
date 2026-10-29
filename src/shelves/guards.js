const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const {
  formatValidationErrors,
  requiredFieldsMessage,
} = require("../auth/validators");
const { REQUIRED_SHELF_FIELDS } = require("./validators");

const READ_ROLES = Object.freeze([
  "admin",
  "seller",
  "manager_warehouse",
  "dispatcher",
]);
const WRITE_ROLES = Object.freeze(["admin", "manager_warehouse"]);

/**
 * Guards the read endpoints: administrators, sellers, warehouse managers and
 * dispatchers can list shelves and sections.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the write endpoints (create, update and delete). Only administrators
 * and warehouse managers can change the hierarchy.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

/**
 * Answers 400 as soon as a required field is absent or null. Unlike the shared
 * request validator, an empty string counts as present so `code` can answer the
 * documented 422 instead of a 400.
 * @param {string[]} fields - Required field names.
 * @returns {import("express").RequestHandler} The middleware.
 */
function requirePresentFields(fields) {
  return (req, res, next) => {
    const body = req.body ?? {};
    const missing = fields.filter(
      (field) => body[field] === undefined || body[field] === null,
    );

    if (missing.length) {
      return res.status(400).json({
        message: requiredFieldsMessage(fields),
      });
    }

    return next();
  };
}

/**
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @param {string[]} [fields] - Required field names; empty for partial updates.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields = REQUIRED_SHELF_FIELDS) {
  return [
    requirePresentFields(fields),
    async (req, res, next) => {
      try {
        req.validated = await schema.validate(req.body ?? {}, {
          abortEarly: false,
          stripUnknown: true,
        });

        return next();
      } catch (error) {
        return res.status(422).json({ errors: formatValidationErrors(error) });
      }
    },
  ];
}

/**
 * Builds a middleware that requires at least one accepted field after
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

/**
 * Rejects a PUT request that tries to change an immutable foreign key. The
 * check runs on the raw body, before yup strips unknown fields.
 * @param {string} field - Immutable field name.
 * @param {string} message - 422 message.
 * @returns {import("express").RequestHandler} The middleware.
 */
function rejectImmutableField(field, message) {
  return (req, res, next) => {
    const body = req.body ?? {};

    if (Object.prototype.hasOwnProperty.call(body, field)) {
      return res.status(422).json({ errors: { [field]: message } });
    }

    return next();
  };
}

module.exports = {
  READ_ROLES,
  WRITE_ROLES,
  readAccess,
  rejectImmutableField,
  requireAnyField,
  validatedBody,
  writeAccess,
};
