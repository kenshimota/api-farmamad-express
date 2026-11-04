const { toDateOnly } = require("./state");

/**
 * Iterates the expired sellable candidates in FEFO order using a keyset
 * cursor. The iterator hides the `after` bookkeeping from the service and
 * yields batches instead of loading the whole inventory into memory.
 * @param {object} options - Iteration options.
 * @param {object} options.repository - Job repository.
 * @param {number[]} options.sellableStateIds - Current sellable state ids.
 * @param {number} options.limit - Maximum rows per batch.
 * @param {object} options.transaction - Open transaction.
 * @returns {AsyncGenerator<object[]>} Candidate batches.
 */
async function* iterateCandidateBatches({
  repository,
  sellableStateIds,
  limit,
  transaction,
}) {
  let after = null;

  for (;;) {
    const batch = await repository.findCandidates({
      sellableStateIds,
      after,
      limit,
      transaction,
    });

    if (batch.length === 0) {
      return;
    }

    yield batch;

    if (batch.length < limit) {
      return;
    }

    const last = batch[batch.length - 1];

    after = {
      expirationDate: toDateOnly(last.expiration_date),
      id: Number(last.id),
    };
  }
}

module.exports = { iterateCandidateBatches };
