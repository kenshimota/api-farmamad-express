const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { foreignKeyField } = require("../shared/foreign-key");
const { isHttpError, sendHttpError } = require("../shared/http-error");
const { ORDER_ALREADY_INVOICED_MESSAGE } = require("./errors");

const FOREIGN_KEY_MESSAGES = Object.freeze({
  customer_id: "Invalid customer id",
  invoiced_by_user_id: "Invalid user id",
  currency_id: "Invalid currency id",
  product_id: "Invalid product id",
  item_state_id: "Invalid item state id",
  invoice_id: "Invalid invoice id",
});
const FOREIGN_KEY_FIELDS = Object.freeze(Object.keys(FOREIGN_KEY_MESSAGES));

/**
 * Tells whether a unique violation belongs to the one-invoice-per-order rule.
 * @param {import("sequelize").UniqueConstraintError} error - Sequelize error.
 * @returns {boolean} True for the `order_id` unique constraint.
 */
function isOrderUniqueViolation(error) {
  const fields = Array.isArray(error.fields)
    ? error.fields
    : Object.keys(error.fields ?? {});
  const text = `${error.message ?? ""} ${error.parent?.detail ?? ""}`;

  return fields.includes("order_id") || text.includes("order_id");
}

/**
 * Translates service and persistence errors into HTTP responses. Controlled
 * errors pass through, a duplicated order answers 409, foreign keys answer
 * 422 and unknown errors are rethrown to the global handler.
 * @param {unknown} error - Error thrown by the service or Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handleInvoiceError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({
      message: isOrderUniqueViolation(error)
        ? ORDER_ALREADY_INVOICED_MESSAGE
        : "Invoice already exists",
    });
  }

  if (error instanceof ForeignKeyConstraintError) {
    const field = foreignKeyField(error, FOREIGN_KEY_FIELDS);

    if (field) {
      return res.status(422).json({
        errors: { [field]: FOREIGN_KEY_MESSAGES[field] },
      });
    }
  }

  throw error;
}

module.exports = {
  FOREIGN_KEY_FIELDS,
  FOREIGN_KEY_MESSAGES,
  handleInvoiceError,
  isOrderUniqueViolation,
};
