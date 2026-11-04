const TRANSACTION = Object.freeze({
  LOCK: { UPDATE: "UPDATE" },
  id: "tx",
});

/**
 * Builds a candidate lot.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} Lot double.
 */
function lot(overrides = {}) {
  return {
    id: 1,
    number: "LOTE-1",
    product_id: 10,
    item_state_id: 1,
    expiration_date: "2026-10-01",
    stock: 5,
    reserved: 0,
    ...overrides,
  };
}

/**
 * Builds a repository double with batched candidates.
 * @param {object} [options] - Double configuration.
 * @param {object[]} [options.batches] - Candidate batches, in order.
 * @param {boolean} [options.locked] - Advisory lock result.
 * @param {object|null} [options.expired] - Expired item state.
 * @param {number} [options.recalculated] - Return of recalculateStock.
 * @returns {object} The repository double.
 */
function setup({
  batches = [[]],
  locked = true,
  expired = { id: 3, name: "expired" },
  recalculated = 1,
} = {}) {
  const remaining = [...batches];
  const repository = {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    tryAdvisoryLock: jest.fn().mockResolvedValue(locked),
    findExpiredItemState: jest.fn().mockResolvedValue(expired),
    findSellableStateIds: jest.fn().mockResolvedValue([1]),
    findCandidates: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(remaining.length > 0 ? remaining.shift() : []),
      ),
    moveToExpired: jest.fn().mockResolvedValue(),
    recalculateStock: jest.fn().mockResolvedValue(recalculated),
  };

  return { repository };
}

module.exports = { TRANSACTION, lot, setup };
