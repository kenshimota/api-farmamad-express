const { Op, QueryTypes, Sequelize } = require("sequelize");
const sequelize = require("../../database");
const Lot = require("../../models/lot");
const ItemState = require("../../models/item-state");
const Stock = require("../../models/stock");

const ADVISORY_LOCK_KEY = 49050;
const CANDIDATE_ORDER = Object.freeze([
  ["expiration_date", "ASC"],
  ["id", "ASC"],
]);

/**
 * Creates the persistence layer of the expire lots job. Every model and the
 * connection are injectable so the repository can be tested without a
 * database.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Lot model.
 * @param {object} [options.itemStateModel] - Item state model.
 * @param {object} [options.stockModel] - Stock model.
 * @param {object} [options.db] - Shared Sequelize instance.
 * @returns {object} The repository.
 */
function createExpireLotsRepository({
  model = Lot,
  itemStateModel = ItemState,
  stockModel = Stock,
  db = sequelize,
} = {}) {
  return {
    /**
     * Runs a callback inside a database transaction.
     * @param {(transaction: object) => Promise<unknown>} callback - Work.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return db.transaction(callback);
    },

    /**
     * Tries to acquire the fixed transaction advisory lock. PostgreSQL releases
     * it automatically when the transaction commits or rolls back.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<boolean>} True when this transaction got the lock.
     */
    async tryAdvisoryLock(transaction) {
      const rows = await db.query(
        'SELECT pg_try_advisory_xact_lock(:key) AS "locked"',
        {
          replacements: { key: ADVISORY_LOCK_KEY },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      return Boolean(rows[0]?.locked);
    },

    /**
     * Finds the destination item state by its stable name.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The `expired` state or null.
     */
    findExpiredItemState(transaction) {
      return itemStateModel.findOne({
        where: { name: "expired" },
        transaction,
      });
    },

    /**
     * Loads the ids of every sellable item state once per run.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<number[]>} Sellable item state ids.
     */
    async findSellableStateIds(transaction) {
      const rows = await itemStateModel.findAll({
        attributes: ["id"],
        where: { is_sellable: true },
        raw: true,
        transaction,
      });

      return rows.map((row) => Number(row.id));
    },

    /**
     * Loads one batch of expired sellable lots in FEFO order. The keyset
     * cursor keeps the job from re-reading lots that already changed state
     * while avoiding OFFSET.
     * @param {object} options - Query options.
     * @param {number[]} options.sellableStateIds - Current sellable state ids.
     * @param {{ expirationDate: string, id: number }|null} [options.after] -
     *   Last processed candidate.
     * @param {number} options.limit - Maximum rows per batch.
     * @param {object} options.transaction - Open transaction.
     * @returns {Promise<object[]>} Candidate lots.
     */
    findCandidates({ sellableStateIds, after = null, limit, transaction }) {
      if (sellableStateIds.length === 0) {
        return Promise.resolve([]);
      }

      const where = {
        item_state_id: { [Op.in]: sellableStateIds },
        expiration_date: {
          [Op.ne]: null,
          [Op.lt]: Sequelize.literal("CURRENT_DATE"),
        },
      };

      if (after) {
        where[Op.and] = [
          {
            [Op.or]: [
              { expiration_date: { [Op.gt]: after.expirationDate } },
              {
                expiration_date: after.expirationDate,
                id: { [Op.gt]: after.id },
              },
            ],
          },
        ];
      }

      return model.findAll({
        where,
        order: CANDIDATE_ORDER,
        limit,
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
    },

    /**
     * Moves one lot to the expired item state.
     * @param {object} lot - Candidate lot instance.
     * @param {number} itemStateId - Destination item state id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object>} The updated lot.
     */
    moveToExpired(lot, itemStateId, transaction) {
      return lot.update({ item_state_id: itemStateId }, { transaction });
    },

    /**
     * Recalculates one `(product_id, item_state_id)` stock row from the
     * physical lots and returns how many rows were written.
     * @param {number} productId - Product id.
     * @param {number} itemStateId - Item state id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<number>} 1 when the row was created or updated.
     */
    async recalculateStock(productId, itemStateId, transaction) {
      const total = await model.sum("stock", {
        where: { product_id: productId, item_state_id: itemStateId },
        transaction,
      });
      const quantity = Number(total) || 0;
      const [stock, created] = await stockModel.findOrCreate({
        where: { product_id: productId, item_state_id: itemStateId },
        defaults: { quantity },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (created) {
        return 1;
      }

      if (Number(stock.quantity) === quantity) {
        return 0;
      }

      await stock.update({ quantity }, { transaction });

      return 1;
    },
  };
}

module.exports = {
  ADVISORY_LOCK_KEY,
  CANDIDATE_ORDER,
  createExpireLotsRepository,
};
