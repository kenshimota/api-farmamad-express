/**
 * Live write strategy: moves the lots and recalculates the affected stock
 * rows inside the open transaction.
 * @param {object} repository - Job repository.
 * @param {object} transaction - Open transaction.
 * @returns {object} Write strategy.
 */
function createLiveWriteStrategy(repository, transaction) {
  return {
    dryRun: false,

    /**
     * Moves one lot to the expired item state.
     * @param {object} lot - Candidate lot instance.
     * @param {number} itemStateId - Destination item state id.
     * @returns {Promise<object>} The updated lot.
     */
    moveToExpired(lot, itemStateId) {
      return repository.moveToExpired(lot, itemStateId, transaction);
    },

    /**
     * Recalculates every affected `(product_id, item_state_id)` stock row.
     * @param {Iterable<object>} pairs - Pairs to recalculate.
     * @returns {Promise<number>} Number of rows created or updated.
     */
    async recalculateStocks(pairs) {
      let updated = 0;

      for (const pair of pairs) {
        updated += await repository.recalculateStock(
          pair.productId,
          pair.itemStateId,
          transaction,
        );
      }

      return updated;
    },
  };
}

/**
 * Dry-run write strategy: keeps the counters and planned pairs but performs no
 * writes, so the caller can roll the transaction back after building the
 * summary.
 * @returns {object} Write strategy.
 */
function createDryRunWriteStrategy() {
  return {
    dryRun: true,

    /**
     * No-op during a dry run.
     * @returns {Promise<void>} Resolves immediately.
     */
    moveToExpired() {
      return Promise.resolve();
    },

    /**
     * No-op during a dry run; no stock row is written.
     * @returns {Promise<number>} Always zero.
     */
    recalculateStocks() {
      return Promise.resolve(0);
    },
  };
}

/**
 * Selects the write strategy for the run.
 * @param {object} options - Strategy options.
 * @param {boolean} options.dryRun - Whether the run must not persist changes.
 * @param {object} options.repository - Job repository.
 * @param {object} options.transaction - Open transaction.
 * @returns {object} The selected write strategy.
 */
function createWriteStrategy({ dryRun, repository, transaction }) {
  return dryRun
    ? createDryRunWriteStrategy()
    : createLiveWriteStrategy(repository, transaction);
}

module.exports = {
  createDryRunWriteStrategy,
  createLiveWriteStrategy,
  createWriteStrategy,
};
