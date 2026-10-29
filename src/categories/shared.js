const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { categoryRepository } = require("./repository");
const { parseCategoryId } = require("./validators");

/**
 * Express middleware for the routes that address a single category. It parses
 * the `:id` parameter, answers 422 when it is not a positive integer and 404
 * when the category does not exist; otherwise it exposes the loaded instance
 * as `req.category` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadCategory(req, res, next) {
  const id = parseCategoryId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid category id" } });
  }

  const category = await categoryRepository.findById(id);

  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  req.category = category;

  return next();
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated name answers 409, any other error is rethrown
 * so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a unique constraint.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Category already exists" });
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * a category referenced by a product (foreign key violation) answers 409, any
 * other error is rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Category is in use" });
  }

  throw error;
}

module.exports = {
  handleDeleteError,
  handleWriteError,
  loadCategory,
};
