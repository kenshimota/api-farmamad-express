/**
 * Normalizes a DATEONLY value to `YYYY-MM-DD`.
 * @param {string|Date|null} value - Stored expiration date.
 * @returns {string|null} The normalized date.
 */
function toDateOnly(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

/**
 * Creates the mutable counters used while the transaction runs.
 * @returns {object} Empty job state.
 */
function createState() {
  return {
    candidates: 0,
    moved: 0,
    skippedReserved: [],
    products: new Set(),
    pairs: new Map(),
    stockRowsUpdated: 0,
    expiredItemStateId: null,
  };
}

/**
 * Records a lot that was skipped because it still has active reservations.
 * @param {object} state - Job counters.
 * @param {object} candidate - Candidate lot.
 * @param {number} reserved - Reserved units reported by the lot.
 * @returns {void}
 */
function registerSkippedReserved(state, candidate, reserved) {
  state.skippedReserved.push({
    lot_id: Number(candidate.id),
    number: candidate.number,
    expiration_date: toDateOnly(candidate.expiration_date),
    reserved,
  });
}

/**
 * Records a lot that was moved (or planned) to `expired` and collects the
 * stock pairs that must be recalculated.
 * @param {object} state - Job counters.
 * @param {object} candidate - Candidate lot.
 * @param {number} previousItemStateId - State the lot had before the move.
 * @param {number} expiredItemStateId - Destination `expired` state id.
 * @returns {void}
 */
function registerMoved(
  state,
  candidate,
  previousItemStateId,
  expiredItemStateId,
) {
  const productId = Number(candidate.product_id);

  state.moved += 1;
  state.products.add(productId);

  for (const itemStateId of [previousItemStateId, expiredItemStateId]) {
    const key = `${productId}:${itemStateId}`;

    state.pairs.set(key, { productId, itemStateId });
  }
}

/**
 * Builds the public summary returned by the service and printed by the
 * command.
 * @param {object} state - Job counters.
 * @param {object} options - Summary options.
 * @param {Date} options.startedAt - Run start.
 * @param {Date} options.finishedAt - Run end.
 * @param {boolean} options.locked - Whether the advisory lock was acquired.
 * @param {boolean} options.dryRun - Whether the run was a dry run.
 * @returns {object} The summary.
 */
function buildSummary(state, { startedAt, finishedAt, locked, dryRun }) {
  return {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    candidates: state.candidates,
    moved: state.moved,
    skipped_reserved: state.skippedReserved,
    affected_products: state.products.size,
    stock_rows_updated: state.stockRowsUpdated,
    expired_item_state_id: state.expiredItemStateId,
    locked,
    dry_run: dryRun,
    errors: [],
  };
}

module.exports = {
  buildSummary,
  createState,
  registerMoved,
  registerSkippedReserved,
  toDateOnly,
};
