const defaultLogger = require("../../config/logger");
const { iterateCandidateBatches } = require("./candidate-iterator");
const { loadConfig } = require("./config");
const { ExpiredItemStateNotFoundError } = require("./errors");
const { createExpireLotsRepository } = require("./repository");
const {
  buildSummary,
  createState,
  registerMoved,
  registerSkippedReserved,
} = require("./state");
const { createWriteStrategy } = require("./write-strategy");

/**
 * Internal signal used to roll back the transaction after building the dry-run
 * summary. It never escapes the service.
 */
class DryRunRollback extends Error {
  /**
   * @param {object} summary - Planned summary to return to the caller.
   */
  constructor(summary) {
    super("Dry run rollback");
    this.name = "DryRunRollback";
    this.summary = summary;
  }
}

/**
 * Processes one candidate batch, delegating the write side to the selected
 * strategy.
 * @param {object} options - Batch options.
 * @param {object[]} options.batch - Candidate lots.
 * @param {object} options.state - Job counters.
 * @param {object} options.writer - Write strategy.
 * @returns {Promise<void>} Resolves when the batch is processed.
 */
async function processBatch({ batch, state, writer }) {
  for (const candidate of batch) {
    state.candidates += 1;

    const reserved = Number(candidate.reserved) || 0;

    if (reserved > 0) {
      registerSkippedReserved(state, candidate, reserved);
      continue;
    }

    const previousItemStateId = Number(candidate.item_state_id);

    await writer.moveToExpired(candidate, state.expiredItemStateId);
    registerMoved(
      state,
      candidate,
      previousItemStateId,
      state.expiredItemStateId,
    );
  }
}

/**
 * Runs the daily expiration job. The whole run happens inside one transaction,
 * starts by acquiring the fixed advisory lock and recalculates only the stock
 * pairs touched by the moved lots.
 * @param {object} [options] - Job options.
 * @param {object} [options.repository] - Repository; defaults to the real one.
 * @param {object} [options.logger] - Logger with info/warn/error.
 * @param {number} [options.batchSize] - Candidate batch size.
 * @param {boolean} [options.dryRun] - Plan only, then roll back.
 * @param {() => Date} [options.now] - Clock used in the summary.
 * @returns {Promise<object>} The job summary.
 * @throws {ExpiredItemStateNotFoundError} When the expired state is missing.
 */
async function runExpireLotsJob({
  repository = createExpireLotsRepository(),
  logger = defaultLogger,
  batchSize,
  dryRun = false,
  now = () => new Date(),
} = {}) {
  const config = loadConfig(process.env, logger);
  const effectiveBatchSize = batchSize ?? config.batchSize;
  const startedAt = now();
  const state = createState();

  logger.info("Expire lots job started", {
    dry_run: dryRun,
    batch_size: effectiveBatchSize,
  });

  let summary;

  try {
    summary = await repository.transaction(async (transaction) => {
      const locked = await repository.tryAdvisoryLock(transaction);

      if (!locked) {
        logger.warn("Advisory lock not acquired; skipping expire lots job", {
          lock_key: 49050,
        });

        return buildSummary(state, {
          startedAt,
          finishedAt: now(),
          locked: false,
          dryRun,
        });
      }

      const expired = await repository.findExpiredItemState(transaction);

      if (!expired) {
        throw new ExpiredItemStateNotFoundError();
      }

      state.expiredItemStateId = Number(expired.id);
      const sellableStateIds =
        await repository.findSellableStateIds(transaction);
      const writer = createWriteStrategy({ dryRun, repository, transaction });

      for await (const batch of iterateCandidateBatches({
        repository,
        sellableStateIds,
        limit: effectiveBatchSize,
        transaction,
      })) {
        await processBatch({ batch, state, writer });
      }

      state.stockRowsUpdated = await writer.recalculateStocks(
        state.pairs.values(),
      );

      const planned = buildSummary(state, {
        startedAt,
        finishedAt: now(),
        locked: true,
        dryRun,
      });

      if (dryRun) {
        throw new DryRunRollback(planned);
      }

      return planned;
    });
  } catch (error) {
    if (error instanceof DryRunRollback) {
      summary = error.summary;
    } else {
      logger.error("Expire lots job failed", { stack: error.stack });
      throw error;
    }
  }

  logger.info("Expire lots job finished", summary);

  return summary;
}

module.exports = { runExpireLotsJob };
