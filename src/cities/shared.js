const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { cityRepository } = require("./repository");
const { parseCityId, STATE_ID_MESSAGE } = require("./validators");

/**
 * Express middleware for the routes that address a single city. It parses the
 * `:id` parameter, answers 422 when it is not a positive integer and 404 when
 * the city does not exist; otherwise it exposes the loaded instance as
 * `req.city` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadCity(req, res, next) {
  const id = parseCityId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid city id" } });
  }

  const city = await cityRepository.findById(id);

  if (!city) {
    return res.status(404).json({ message: "City not found" });
  }

  req.city = city;

  return next();
}

/**
 * Express middleware that verifies the referenced state before a create or
 * update reaches the database. It answers 422 when the state is missing; the
 * foreign key of the migration remains the final safeguard for concurrent
 * deletions. Updates that do not touch state_id skip the check.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function ensureState(req, res, next) {
  const { state_id } = req.validated;

  if (state_id === undefined) {
    return next();
  }

  if (!(await cityRepository.stateExists(state_id))) {
    return res.status(422).json({ errors: { state_id: STATE_ID_MESSAGE } });
  }

  return next();
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated pair answers 409, a foreign key violation
 * answers 422 for state_id, and any other error is rethrown.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "City already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    return res.status(422).json({ errors: { state_id: STATE_ID_MESSAGE } });
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * a city referenced by a supplier (foreign key violation) answers 409, any
 * other error is rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "City is in use" });
  }

  throw error;
}

module.exports = {
  ensureState,
  handleDeleteError,
  handleWriteError,
  loadCity,
};
