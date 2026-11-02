const { UniqueConstraintError } = require("sequelize");
const Customer = require("../models/customer");
const PriceList = require("../models/price-list");
const PaymentTerm = require("../models/payment-term");
const {
  PAYMENT_TERM_ID_MESSAGE,
  PRICE_LIST_ID_MESSAGE,
  parseCustomerId,
} = require("./validators");
const { findAssignablePaymentTerm } = require("../payment-terms/assignment");

const CUSTOMER_INCLUDE = Object.freeze([
  {
    model: PriceList,
    as: "price_list",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: PaymentTerm,
    as: "payment_term",
    attributes: ["id", "code", "name", "days"],
    required: false,
  },
]);

/**
 * Express middleware for the routes that address a single customer. It parses
 * the `:id` parameter, answers 422 when it is not a positive integer and 404
 * when the customer does not exist; otherwise it exposes the loaded instance
 * as `req.customer` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadCustomer(req, res, next) {
  const id = parseCustomerId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid customer id" } });
  }

  const customer = await Customer.findByPk(id, { include: CUSTOMER_INCLUDE });

  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }

  req.customer = customer;

  return next();
}

/**
 * Express middleware that validates an optional `price_list_id` reference
 * before writing a customer. A missing or `null` value is accepted; a positive
 * integer must point to an existing price list.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function ensurePriceListAssignment(req, res, next) {
  const priceListId = req.validated.price_list_id;

  if (priceListId === undefined || priceListId === null) {
    return next();
  }

  const priceList = await PriceList.findByPk(priceListId);

  if (!priceList) {
    return res
      .status(422)
      .json({ errors: { price_list_id: PRICE_LIST_ID_MESSAGE } });
  }

  return next();
}

/**
 * Express middleware that validates an optional `payment_term_id` reference
 * before writing a customer. A missing or `null` value is accepted; a positive
 * integer must point to an existing active payment term.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function ensurePaymentTermAssignment(req, res, next) {
  const paymentTermId = req.validated.payment_term_id;

  if (paymentTermId === undefined || paymentTermId === null) {
    return next();
  }

  const term = await findAssignablePaymentTerm(paymentTermId);

  if (!term) {
    return res
      .status(422)
      .json({ errors: { payment_term_id: PAYMENT_TERM_ID_MESSAGE } });
  }

  return next();
}

/**
 * Reloads a customer with its price list and payment term associations so the
 * response always exposes both nested summaries.
 * @param {object} customer - Stored customer.
 * @returns {Promise<object>} The customer with `price_list` loaded.
 */
function reloadCustomer(customer) {
  return Customer.findByPk(customer.id, { include: CUSTOMER_INCLUDE });
}

/**
 * Translates the persistence errors of the create and update handlers into
 * HTTP responses: a duplicated email answers 409, any other error is rethrown
 * so the global error handler keeps working.
 * @param {unknown} error - Error thrown by Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The 409 response.
 * @throws {unknown} The original error when it is not a unique constraint.
 */
function handleWriteError(error, res) {
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Customer already exists" });
  }

  throw error;
}

module.exports = {
  CUSTOMER_INCLUDE,
  ensurePaymentTermAssignment,
  ensurePriceListAssignment,
  handleWriteError,
  loadCustomer,
  reloadCustomer,
};
