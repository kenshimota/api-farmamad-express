const { currencyRepository } = require("./repository");
const { parseCurrencyId } = require("./parsers");
const {
  currencyNotFound,
  invalidCurrencyId,
  sendHttpError,
} = require("./errors");

/**
 * Shared middleware implementation that parses the `:id` parameter, answers
 * 422 when it is invalid and 404 when the currency does not exist.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @param {boolean} activeOnly - Treat inactive currencies as missing.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function load(req, res, next, activeOnly) {
  const id = parseCurrencyId(req.params.id);

  if (id === null) {
    return sendHttpError(res, invalidCurrencyId());
  }

  const currency = await currencyRepository.findById(id);

  if (!currency || (activeOnly && !currency.is_active)) {
    return sendHttpError(res, currencyNotFound());
  }

  req.currency = currency;

  return next();
}

/**
 * Express middleware for the routes that address any currency, including
 * inactive ones. It exposes the loaded instance as `req.currency`.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
function loadCurrency(req, res, next) {
  return load(req, res, next, false);
}

/**
 * Express middleware for DELETE and other operations that must treat an
 * already deactivated currency as missing.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
function loadActiveCurrency(req, res, next) {
  return load(req, res, next, true);
}

module.exports = {
  loadActiveCurrency,
  loadCurrency,
};
