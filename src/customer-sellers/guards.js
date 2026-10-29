const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");

const READ_ROLES = Object.freeze(["admin", "seller", "dispatcher"]);
const WRITE_ROLES = Object.freeze(["admin", "seller"]);
const SELLER_ROLE = "seller";

/**
 * Guards the read endpoints: administrators, dispatchers and sellers (only
 * their own assignments) can list and inspect assignments.
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
 * Tells whether the authenticated user is a seller.
 * @param {object} [user] - Authenticated token payload.
 * @returns {boolean} True for sellers.
 */
function isSeller(user) {
  return Boolean(user) && user.role === SELLER_ROLE;
}

/**
 * Tells whether the authenticated user owns the given assignment.
 * @param {object} user - Authenticated token payload.
 * @param {object} assignment - Loaded assignment.
 * @returns {boolean} True when the assignment belongs to the user.
 */
function ownsAssignment(user, assignment) {
  return Number(user.sub) === Number(assignment.seller_id);
}

/**
 * Answers the documented 403 used by every ownership rule.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The forbidden response.
 */
function forbidden(res) {
  return res.status(403).json({ message: "Forbidden" });
}

/**
 * Read authorization policy: a seller may only read their own assignment.
 * Runs after `loadAssignment`, which exposes `req.customerSeller`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {import("express").Response|void} Continues or answers 403.
 */
function requireAssignmentOwnership(req, res, next) {
  if (isSeller(req.user) && !ownsAssignment(req.user, req.customerSeller)) {
    return forbidden(res);
  }

  return next();
}

/**
 * Write authorization policy: a seller may only assign customers to themselves.
 * Runs after the body validation, which exposes `req.validated.seller_id`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {import("express").Response|void} Continues or answers 403.
 */
function requireSelfAssignment(req, res, next) {
  const targetsSelf = Number(req.user.sub) === Number(req.validated.seller_id);

  if (isSeller(req.user) && !targetsSelf) {
    return forbidden(res);
  }

  return next();
}

/**
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @param {string[]} fields - Required field names.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields) {
  return [validateRequest({ schema, fields })];
}

module.exports = {
  READ_ROLES,
  SELLER_ROLE,
  WRITE_ROLES,
  isSeller,
  ownsAssignment,
  readAccess,
  requireAssignmentOwnership,
  requireSelfAssignment,
  validatedBody,
  writeAccess,
};
