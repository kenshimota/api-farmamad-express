const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { priceListRepository } = require("./repository");
const { parsePriceListId } = require("./validators");

const READ_ROLES = Object.freeze(["admin", "seller"]);
const WRITE_ROLES = Object.freeze(["admin", "seller"]);

const PRICE_LIST_EXISTS_MESSAGE = "Price list already exists";
const PRICE_LIST_IN_USE_MESSAGE = "Price list is in use";

/**
 * Guards the read endpoints: only administrators and sellers can list or
 * inspect price lists.
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
 * Composes the body validation chain for a schema.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @param {string[]} fields - Required field names.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function validatedBody(schema, fields) {
  return [validateRequest({ schema, fields })];
}

/**
 * Express middleware for the routes that address a single price list. It parses
 * the `:id` parameter, answers 422 when it is not a positive integer and 404
 * when the list does not exist; otherwise it exposes the loaded instance as
 * `req.priceList`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadPriceList(req, res, next) {
  const id = parsePriceListId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid price list id" } });
  }

  const priceList = await priceListRepository.findById(id);

  if (!priceList) {
    return res.status(404).json({ message: "Price list not found" });
  }

  req.priceList = priceList;

  return next();
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated name answers 409 and any other error is
 * rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a unique constraint.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: PRICE_LIST_EXISTS_MESSAGE });
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * a list still referenced by a customer answers 409, any other error is
 * rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: PRICE_LIST_IN_USE_MESSAGE });
  }

  throw error;
}

module.exports = {
  PRICE_LIST_EXISTS_MESSAGE,
  PRICE_LIST_IN_USE_MESSAGE,
  READ_ROLES,
  WRITE_ROLES,
  handleDeleteError,
  handleWriteError,
  loadPriceList,
  readAccess,
  validatedBody,
  writeAccess,
};
