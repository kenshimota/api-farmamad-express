const { paymentTermService } = require("./service");
const { invalidPaymentTermId, paymentTermNotFound } = require("./errors");
const { sendHttpError } = require("../shared/http-error");
const { parsePaymentTermId } = require("./validators");

/**
 * Express middleware for the routes addressed by `:id`. It parses the
 * parameter, loads the term and answers 422/404 when needed.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after continuing or responding.
 */
async function loadPaymentTerm(req, res, next) {
  const id = parsePaymentTermId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidPaymentTermId());
  }

  const paymentTerm = await paymentTermService.getPaymentTerm(id);

  if (!paymentTerm) {
    return sendHttpError(res, paymentTermNotFound());
  }

  req.paymentTerm = paymentTerm;

  return next();
}

module.exports = { loadPaymentTerm };
