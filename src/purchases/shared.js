const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const {
  ITEM_STATE_ID_MESSAGE,
  PRODUCT_ID_MESSAGE,
  SUPPLIER_ID_MESSAGE,
} = require("./validators");

const FOREIGN_KEY_FIELDS = Object.freeze([
  "supplier_id",
  "product_id",
  "item_state_id",
]);

/**
 * Reads the foreign key field named by a Sequelize constraint error.
 * @param {ForeignKeyConstraintError} error - Sequelize constraint error.
 * @returns {string|null} The matching field name or null.
 */
function foreignKeyField(error) {
  const fields = error.fields;
  const candidates = Array.isArray(fields) ? fields : Object.keys(fields ?? {});
  const direct = candidates.find((field) => FOREIGN_KEY_FIELDS.includes(field));

  if (direct) {
    return direct;
  }

  const message = `${error.message ?? ""} ${
    error.parent?.detail ?? ""
  }`.toLowerCase();

  return FOREIGN_KEY_FIELDS.find((field) => message.includes(field)) ?? null;
}

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
  if (error && typeof error.status === "number" && error.body) {
    return res.status(error.status).json(error.body);
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "Item already exists" });
  }

  if (error instanceof ForeignKeyConstraintError) {
    const field = foreignKeyField(error);

    if (field === "supplier_id") {
      return res
        .status(422)
        .json({ errors: { supplier_id: SUPPLIER_ID_MESSAGE } });
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
