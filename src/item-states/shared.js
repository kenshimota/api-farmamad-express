const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { itemStateRepository } = require("./repository");
const { parseItemStateId } = require("./validators");

/**
 * Express middleware for the routes that address a single item state. It
 * parses the `:id` parameter, answers 422 when it is not a positive integer
 * and 404 when the item state does not exist; otherwise it exposes the loaded
 * instance as `req.item_state` so handlers only deal with the operation.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadItemState(req, res, next) {
  const id = parseItemStateId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid item state id" } });
  }

  const itemState = await itemStateRepository.findById(id);

  if (!itemState) {
    return res.status(404).json({ message: "Item state not found" });
  }

  req.item_state = itemState;

  return next();
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated name answers 409, a foreign key violation while
 * renaming answers 409 with the in-use message, and any other error is
 * rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Item state already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Item state is in use" });
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * an item state referenced by costs, stocks or purchase items (foreign key
 * violation) answers 409, any other error is rethrown so the global error
 * handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Item state is in use" });
  }

  throw error;
}

module.exports = {
  handleDeleteError,
  handleWriteError,
  loadItemState,
};
