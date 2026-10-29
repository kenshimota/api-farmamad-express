const { customerSellerService } = require("./service");
const {
  assignmentNotFound,
  invalidAssignmentId,
  sendHttpError,
} = require("./errors");
const { parseAssignmentId } = require("./parsers");

/**
 * Express middleware for the routes addressed by `:id`. It parses the
 * parameter, loads the assignment with its relations and answers 422/404 when
 * needed.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after continuing or responding.
 */
async function loadAssignment(req, res, next) {
  const id = parseAssignmentId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidAssignmentId());
  }

  const assignment = await customerSellerService.getAssignment(id);

  if (!assignment) {
    return sendHttpError(res, assignmentNotFound());
  }

  req.customerSeller = assignment;

  return next();
}

module.exports = { loadAssignment };
