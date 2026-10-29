const { methodPaymentTypeService } = require("./service");
const {
  invalidMethodPaymentTypeId,
  methodPaymentTypeNotFound,
} = require("./errors");
const { sendHttpError } = require("../shared/http-error");
const { parseMethodPaymentTypeId } = require("./parsers");

/**
 * Express middleware for the routes addressed by `:id`. It parses the
 * parameter, loads the type and answers 422/404 when needed.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after continuing or responding.
 */
async function loadMethodPaymentType(req, res, next) {
  const id = parseMethodPaymentTypeId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidMethodPaymentTypeId());
  }

  const type = await methodPaymentTypeService.getMethodPaymentType(id);

  if (!type) {
    return sendHttpError(res, methodPaymentTypeNotFound());
  }

  req.methodPaymentType = type;

  return next();
}

module.exports = { loadMethodPaymentType };
