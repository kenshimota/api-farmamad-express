const { taxService } = require("./service");
const { invalidTaxId, taxNotFound } = require("./errors");
const { sendHttpError } = require("../shared/http-error");
const { parseTaxId } = require("./parsers");

/**
 * Express middleware for the routes addressed by `:id`. It parses the
 * parameter, loads the tax and answers 422/404 when needed.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after continuing or responding.
 */
async function loadTax(req, res, next) {
  const id = parseTaxId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidTaxId());
  }

  const tax = await taxService.getTax(id);

  if (!tax) {
    return sendHttpError(res, taxNotFound());
  }

  req.tax = tax;

  return next();
}

module.exports = { loadTax };
