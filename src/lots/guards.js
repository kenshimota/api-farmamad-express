const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const {
  formatValidationErrors,
  requiredFieldsMessage,
} = require("../auth/validators");
const { REQUIRED_LOT_FIELDS } = require("./validators");

const READ_ROLES = Object.freeze([
  "admin",
  "seller",
  "manager_warehouse",
  "dispatcher",
]);
const WRITE_ROLES = Object.freeze(["admin", "seller", "manager_warehouse"]);

/**
 * Guards the read endpoints: administrators, sellers, warehouse managers and
 * dispatchers can list and inspect lots.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES)];
}

/**
 * Guards the write endpoints (create, update and delete).
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function writeAccess() {
  return [authenticate, authorize(...WRITE_ROLES)];
}

/**
 * Answers 400 as soon as a required field is absent or null. An empty string
 * counts as present so the field validators can answer 422 instead.
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
 * @param {string[]} [fields] - Required field names.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields = REQUIRED_LOT_FIELDS) {
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

module.exports = {
  READ_ROLES,
  WRITE_ROLES,
  readAccess,
  requirePresentFields,
  validatedBody,
  writeAccess,
};
