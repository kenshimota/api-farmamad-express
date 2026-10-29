const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const { foreignKeyField } = require("../shared/foreign-key");
const { isHttpError, sendHttpError } = require("../shared/http-error");
const {
  CURRENCY_ID_MESSAGE,
  ITEM_STATE_ID_MESSAGE,
  PRODUCT_ID_MESSAGE,
  SUPPLIER_ID_MESSAGE,
} = require("./validators");

const FOREIGN_KEY_FIELDS = Object.freeze([
  "supplier_id",
  "currency_id",
  "product_id",
  "item_state_id",
]);

/**
 * Translates service and persistence errors into HTTP responses. Errors with a
 * `status` and `body` come from the service layer; a duplicated line answers
 * 409 and a foreign key race answers 422 for the affected field. Any other
 * error is rethrown so the global error handler keeps working.
 * @param {unknown} error - Error thrown by the service or Sequelize.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it cannot be classified.
 */
function handlePurchaseError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Item already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    const field = foreignKeyField(error, FOREIGN_KEY_FIELDS);

    if (field === "supplier_id") {
      return res
        .status(422)
        .json({ errors: { supplier_id: SUPPLIER_ID_MESSAGE } });
    }

    if (field === "currency_id") {
      return res
        .status(422)
        .json({ errors: { currency_id: CURRENCY_ID_MESSAGE } });
    }

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
  }

  throw error;
}

module.exports = {
  handlePurchaseError,
};
