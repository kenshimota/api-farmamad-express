const Currency = require("../models/currency");
const { httpError } = require("./errors");

const DEFAULT_TRANSACTION_MESSAGE =
  "Default transaction currency is not configured";
const INVALID_CURRENCY_MESSAGE = "Invalid currency";

/**
 * Finds the active currency marked as the default for transactions.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Currency model used for the query.
 * @returns {Promise<object|null>} The default currency or null.
 */
function findDefaultTransactionCurrency({ model = Currency } = {}) {
  return model.findOne({
    where: { is_default_for_transactions: true, is_active: true },
  });
}

/**
 * Resolves the active default currency for transactions.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Currency model used for the query.
 * @returns {Promise<object>} The default currency.
 * @throws {Error} 503 when no active default currency is configured.
 */
async function resolveDefaultTransactionCurrency(options) {
  const currency = await findDefaultTransactionCurrency(options);

  if (!currency) {
    throw httpError(503, { message: DEFAULT_TRANSACTION_MESSAGE });
  }

  return currency;
}

/**
 * Finds an existing and active currency by id.
 * @param {number} id - Currency id.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Currency model used for the query.
 * @returns {Promise<object|null>} The active currency or null.
 */
function findActiveCurrency(id, { model = Currency } = {}) {
  return model.findOne({ where: { id, is_active: true } });
}

/**
 * Resolves the currency of a new or updated transaction. When `currencyId` is
 * omitted it falls back to the active default currency; an explicit currency
 * must exist and be active.
 * @param {number|undefined} currencyId - Requested currency id.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Currency model used for the queries.
 * @returns {Promise<object>} The resolved currency.
 * @throws {Error} 422 for an invalid currency or 503 without a default.
 */
async function resolveTransactionCurrency(currencyId, options) {
  if (currencyId === undefined) {
    return resolveDefaultTransactionCurrency(options);
  }

  const currency = await findActiveCurrency(currencyId, options);

  if (!currency) {
    throw httpError(422, {
      errors: { currency_id: INVALID_CURRENCY_MESSAGE },
    });
  }

  return currency;
}

module.exports = {
  DEFAULT_TRANSACTION_MESSAGE,
  INVALID_CURRENCY_MESSAGE,
  findActiveCurrency,
  findDefaultTransactionCurrency,
  resolveDefaultTransactionCurrency,
  resolveTransactionCurrency,
};
