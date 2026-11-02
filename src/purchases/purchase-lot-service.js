const { Op, Sequelize } = require("sequelize");
const Lot = require("../models/lot");
const { incompatibleLot } = require("./errors");

/**
 * Normalizes a DATEONLY value (Sequelize returns strings, other paths may pass
 * a Date) into `YYYY-MM-DD` so two equivalent dates always compare equal.
 * @param {unknown} value - Date-like value.
 * @returns {string|null} The normalized date or null.
 */
function toDateOnly(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

/**
 * Creates the service that creates or reuses the lot of every confirmed
 * purchase line. It runs inside the confirmation transaction and locks the
 * existing lot with `FOR UPDATE`, so concurrent confirmations serialize their
 * increments.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.lotModel] - Lot model.
 * @returns {{ receiveLine: Function }} The lot receiving service.
 */
function createPurchaseLotService({ lotModel = Lot } = {}) {
  /**
   * Finds a lot by product and case-insensitive number inside a transaction.
   * @param {number} productId - Product id.
   * @param {string} number - Lot number.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object|null>} The locked lot or null.
   */
  function findForUpdate(productId, number, transaction) {
    return lotModel.findOne({
      where: {
        product_id: productId,
        [Op.and]: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("number")),
          String(number).toLowerCase(),
        ),
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  /**
   * Creates the pending lot of a purchase line or increments the stock of the
   * existing one. A lot can only be reused when the item state and expiration
   * date match; otherwise the whole confirmation fails with 409.
   * @param {object} line - Purchase line with lot_number, expiration_date,
   *   product_id, item_state_id and quantity.
   * @param {object} transaction - Open transaction.
   * @returns {Promise<object>} The created or updated lot.
   * @throws {Error} 409 when the existing lot has different data.
   */
  async function receiveLine(line, transaction) {
    const existing = await findForUpdate(
      line.product_id,
      line.lot_number,
      transaction,
    );

    if (existing) {
      const sameState =
        Number(existing.item_state_id) === Number(line.item_state_id);
      const sameExpiration =
        toDateOnly(existing.expiration_date) ===
        toDateOnly(line.expiration_date);

      if (!sameState || !sameExpiration) {
        throw incompatibleLot();
      }

      return existing.update(
        { stock: Number(existing.stock) + Number(line.quantity) },
        { transaction },
      );
    }

    return lotModel.create(
      {
        number: line.lot_number,
        product_id: line.product_id,
        expiration_date: line.expiration_date,
        item_state_id: line.item_state_id,
        stock: line.quantity,
        reserved: 0,
        location_status: "pending",
        warehouse_id: null,
        shelf_id: null,
        section_id: null,
        location_started_at: null,
        location_started_by: null,
        located_at: null,
        located_by: null,
      },
      { transaction },
    );
  }

  return { receiveLine };
}

module.exports = { createPurchaseLotService, toDateOnly };
