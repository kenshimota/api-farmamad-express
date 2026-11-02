const { Op } = require("sequelize");
const { findPage } = require("../shared/pagination");

/**
 * Restricts a lot listing to the lots received through purchases of one
 * supplier. A bounded second query resolves the lot ids, avoiding a joined
 * count that would duplicate rows.
 * @param {object} model - Lot model.
 * @param {object} options - Sequelize listing options.
 * @param {object} pagination - Parsed pagination.
 * @param {number} [supplierId] - Supplier filter.
 * @returns {Promise<object[]|{ rows: object[], meta: object }>} Result.
 */
async function filterBySupplier(model, options, pagination, supplierId) {
  if (supplierId === undefined) {
    return findPage(model, options, pagination);
  }

  // Loaded lazily so the lots unit tests can keep the model layer mocked.
  const PurchaseItem = require("../models/purchase-item");
  const Purchase = require("../models/purchase");
  const rows = await PurchaseItem.findAll({
    attributes: ["received_lot_id"],
    raw: true,
    include: [
      {
        model: Purchase,
        as: "purchase",
        attributes: [],
        required: true,
        where: { supplier_id: supplierId },
      },
    ],
  });
  const ids = [...new Set(rows.map((row) => row.received_lot_id))];

  options.where = { ...(options.where ?? {}), id: { [Op.in]: ids } };

  return findPage(model, options, pagination);
}

module.exports = { filterBySupplier };
