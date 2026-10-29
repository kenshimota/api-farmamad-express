const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { imageRepository } = require("./repository");
const { parseImageId } = require("./validators");

/**
 * Express middleware for the routes that address a single image. It parses the
 * `:id` parameter, answers 422 when it is not a positive integer and 404 when
 * the image does not exist; otherwise it exposes the loaded instance as
 * `req.image` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadImage(req, res, next) {
  const id = parseImageId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid image id" } });
  }

  const image = await imageRepository.findById(id);

  if (!image) {
    return res.status(404).json({ message: "Image not found" });
  }

  req.image = image;

  return next();
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated reference answers 409, any other error is
 * rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a unique constraint.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Image already exists" });
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * an image referenced by a product (foreign key violation) answers 409, any
 * other error is rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Image is in use" });
  }

  throw error;
}

module.exports = {
  handleDeleteError,
  handleWriteError,
  loadImage,
};
