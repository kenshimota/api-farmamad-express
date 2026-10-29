const { missingFields, requiredFieldsMessage } = require("../auth/validators");
const { parseWarehouseId, REQUIRED_WAREHOUSE_FIELDS } = require("./validators");
const { warehouseRepository } = require("./repository");
const { normalizeTerm, buildPartialFilter } = require("./search");

/**
 * Express middleware for the routes that address a single warehouse. It parses
 * the `:id` parameter, answers 422 when it is not a positive integer and 404
 * when the warehouse does not exist; otherwise it exposes the loaded instance
 * as `req.warehouse` so handlers only deal with the operation itself.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadWarehouse(req, res, next) {
  const id = parseWarehouseId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid warehouse id" } });
  }

  const warehouse = await warehouseRepository.findById(id);

  if (!warehouse) {
    return res.status(404).json({ message: "Warehouse not found" });
  }

  req.warehouse = warehouse;

  return next();
}

/**
 * Answers 400 with the documented message as soon as `name` or `address` is
 * missing, so the client always receives the combined contract message even
 * when only one of the two fields is absent.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {import("express").Response|void} The 400 response or undefined.
 */
function requireWarehouseFields(req, res, next) {
  const missing = missingFields(req.body ?? {}, REQUIRED_WAREHOUSE_FIELDS);

  if (missing.length) {
    return res.status(400).json({
      message: requiredFieldsMessage(REQUIRED_WAREHOUSE_FIELDS),
    });
  }

  return next();
}

module.exports = {
  buildSearchFilter: buildPartialFilter,
  loadWarehouse,
  normalizeSearch: normalizeTerm,
  requireWarehouseFields,
};
