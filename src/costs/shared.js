const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { costRepository } = require("./repository");
const { resolveTransactionCurrency } = require("../currencies/default");
const { foreignKeyField } = require("../shared/foreign-key");
const { isHttpError, sendHttpError } = require("../shared/http-error");
const {
  CURRENCY_ID_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  PRODUCT_ID_MESSAGE,
  parseCostId,
} = require("./validators");

const FOREIGN_KEY_FIELDS = Object.freeze([
  "product_id",
  "item_state_id",
  "currency_id",
]);

/**
 * Express middleware for the routes that address a single cost. It parses the
 * `:id` parameter, answers 422 when it is not a positive integer and 404 when
 * the cost does not exist; otherwise it exposes the loaded instance as
 * `req.cost` so handlers only deal with the operation.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadCost(req, res, next) {
  const id = parseCostId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid cost id" } });
  }

  const cost = await costRepository.findById(id);

  if (!cost) {
    return res.status(404).json({ message: "Cost not found" });
  }

  req.cost = cost;

  return next();
}

/**
 * Express middleware that verifies the referenced product and item state before
 * a create or update reaches the database. Only the fields present in the
 * validated body are checked, so a partial update stays valid. The foreign keys
 * of the migration remain the final safeguard for concurrent deletions.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function ensureReferences(req, res, next) {
  const { product_id, item_state_id } = req.validated;

  if (
    product_id !== undefined &&
    !(await costRepository.productExists(product_id))
  ) {
    return res.status(422).json({ errors: { product_id: PRODUCT_ID_MESSAGE } });
  }

  if (
    item_state_id !== undefined &&
    !(await costRepository.itemStateExists(item_state_id))
  ) {
    return res
      .status(422)
      .json({ errors: { item_state_id: ITEM_STATE_ID_MESSAGE } });
  }

  return next();
}

/**
 * Builds the middleware that resolves the currency of a create or update. A
 * create without `currency_id` receives the active default currency; an update
 * keeps the stored currency when the field is omitted. An explicit currency
 * must exist and be active.
 * @param {object} [options] - Resolver options.
 * @param {boolean} [options.forUpdate] - Keep the stored currency when omitted.
 * @returns {import("express").RequestHandler} The resolver middleware.
 */
function createCurrencyResolver({ forUpdate = false } = {}) {
  return async function resolveCurrency(req, res, next) {
    if (forUpdate && req.validated.currency_id === undefined) {
      return next();
    }

    try {
      const currency = await resolveTransactionCurrency(
        req.validated.currency_id,
      );

      req.validated.currency_id = currency.id;

      return next();
    } catch (error) {
      if (isHttpError(error)) {
        return sendHttpError(res, error);
      }

      throw error;
    }
  };
}

const resolveCreateCurrency = createCurrencyResolver();
const resolveUpdateCurrency = createCurrencyResolver({ forUpdate: true });

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated combination answers 409, a foreign key
 * violation answers 422 for the affected field, and any other error is
 * rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Cost already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    const field = foreignKeyField(error, FOREIGN_KEY_FIELDS);

    if (field === "product_id") {
      return res
        .status(422)
        .json({ errors: { product_id: PRODUCT_ID_MESSAGE } });
    }

    if (field === "item_state_id") {
      return res
        .status(422)
        .json({ errors: { item_state_id: ITEM_STATE_ID_MESSAGE } });
    }

    if (field === "currency_id") {
      return res
        .status(422)
        .json({ errors: { currency_id: CURRENCY_ID_MESSAGE } });
    }
  }

  throw error;
}

/**
 * Translates the persistence errors of the delete handler into HTTP responses:
 * a cost referenced by another row answers 409, any other error is rethrown so
 * the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a foreign key violation.
 */
function handleDeleteError(error, res) {
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: "Cost is in use" });
  }

  throw error;
}

module.exports = {
  createCurrencyResolver,
  ensureReferences,
  handleDeleteError,
  handleWriteError,
  loadCost,
  resolveCreateCurrency,
  resolveUpdateCurrency,
};
