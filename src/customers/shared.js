const { UniqueConstraintError } = require("sequelize");
const Customer = require("../models/customer");
const { parseCustomerId } = require("./validators");

/**
 * Express middleware for the routes that address a single customer. It parses
 * the `:id` parameter, answers 422 when it is not a positive integer and 404
 * when the customer does not exist; otherwise it exposes the loaded instance
 * as `req.customer` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadCustomer(req, res, next) {
  const id = parseCustomerId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid customer id" } });
  }

  const customer = await Customer.findByPk(id);

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  req.customer = customer;

  return next();
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated email answers 409, any other error is rethrown
 * so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a unique constraint.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Customer already exists" });
  }

  throw error;
}

module.exports = { handleWriteError, loadCustomer };
