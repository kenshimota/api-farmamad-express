const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const User = require("../models/user");
const sequelize = require("../database");

const LIST_ORDER = Object.freeze([
  ["is_base", "DESC"],
  ["code", "ASC"],
]);
const HISTORY_ORDER = Object.freeze([
  ["changed_at", "DESC"],
  ["id", "DESC"],
]);
const CHANGED_BY_ATTRIBUTES = Object.freeze(["id", "username", "email"]);

/**
 * Creates a repository that encapsulates every persistence call of the
 * currencies module, including the append-only history. The models and the
 * Sequelize instance are injectable to keep the abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Currency model.
 * @param {object} [options.historyModel] - CurrencyRateHistory model.
 * @param {object} [options.userModel] - User model used by the history include.
 * @param {object} [options.db] - Shared Sequelize instance.
 * @returns {object} Currency repository.
 */
function createCurrencyRepository({
  model = Currency,
  historyModel = CurrencyRateHistory,
  userModel = User,
  db = sequelize,
} = {}) {
  /**
   * Loads a currency by primary key.
   * @param {number} id - Currency id.
   * @param {object} [options] - Query options.
   * @param {object} [options.transaction] - Open transaction.
   * @param {string} [options.lock] - Row lock mode.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(id, { transaction, lock } = {}) {
    return model.findByPk(id, { transaction, lock });
  }

  return {
    /**
     * Starts a transaction with the shared Sequelize instance.
     * @param {Function} callback - Work to run inside the transaction.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return db.transaction(callback);
    },

    /**
     * Persists a currency.
     * @param {object} values - Currency attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The created instance.
     */
    create(values, { transaction } = {}) {
      return model.create(values, { transaction });
    },

    /**
     * Appends one immutable row to the rate history.
     * @param {object} values - History attributes.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The created history row.
     */
    createHistory(values, { transaction } = {}) {
      return historyModel.create(values, { transaction });
    },

    /**
     * Lists currencies with the base row first and then by code. Inactive rows
     * are excluded unless `includeInactive` is true.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.includeInactive] - Include deactivated rows.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ includeInactive = false } = {}) {
      const query = { order: LIST_ORDER };

      if (!includeInactive) {
        query.where = { is_active: true };
      }

      return model.findAll(query);
    },

    findById,

    /**
     * Loads and locks a currency row inside a transaction.
     * @param {number} id - Currency id.
     * @param {object} transaction - Open transaction.
     * @returns {Promise<object|null>} The locked instance or null.
     */
    findByIdForUpdate(id, transaction) {
      return findById(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    },

    /**
     * Persists changes on an existing currency.
     * @param {object} currency - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Persistence options.
     * @param {object} [options.transaction] - Open transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(currency, values, { transaction } = {}) {
      return currency.update(values, { transaction });
    },

    /**
     * Lists the rate history of one currency with the authoring user.
     * @param {number} currencyId - Currency id.
     * @returns {Promise<object[]>} History rows ordered by changed_at DESC.
     */
    listHistory(currencyId) {
      return historyModel.findAll({
        where: { currency_id: currencyId },
        order: HISTORY_ORDER,
        include: [
          {
            model: userModel,
            as: "changed_by_user",
            attributes: [...CHANGED_BY_ATTRIBUTES],
          },
        ],
      });
    },
  };
}

const currencyRepository = createCurrencyRepository();

module.exports = {
  CHANGED_BY_ATTRIBUTES,
  HISTORY_ORDER,
  LIST_ORDER,
  createCurrencyRepository,
  currencyRepository,
};
