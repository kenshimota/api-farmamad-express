const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { REQUIRED_PAYMENT_TERM_FIELDS } = require("./fields");

const ROLES = Object.freeze(["admin", "seller"]);

/**
 * Guards both the read and write endpoints: only administrators and sellers
 * can manage the payment term catalog.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function access() {
  return [authenticate, authorize(...ROLES)];
}

/**
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @param {string[]} [fields] - Required field names; empty for partial updates.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields = REQUIRED_PAYMENT_TERM_FIELDS) {
  return [validateRequest({ schema, fields })];
}

/**
 * Requires at least one editable field after validation so a PUT cannot send
 * an empty payload.
 * @param {string[]} fields - Accepted field names.
 * @returns {import("express").RequestHandler} The middleware.
 */
function requireAnyField(fields) {
  return (req, res, next) => {
    const present = fields.some((field) => req.validated[field] !== undefined);

    if (!present) {
      return res
        .status(400)
        .json({ message: "At least one field is required" });
    }

    return next();
  };
}

module.exports = { ROLES, access, requireAnyField, validatedBody };
