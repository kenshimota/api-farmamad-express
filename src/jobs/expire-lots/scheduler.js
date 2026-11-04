const defaultLogger = require("../../config/logger");
const { loadConfig } = require("./config");
const { runExpireLotsJob } = require("./service");

/**
 * Calculates the next UTC occurrence of the configured hour and minute.
 * @param {Date} from - Current instant.
 * @param {{ hourUtc: number, minuteUtc: number }} config - Schedule config.
 * @returns {Date} The next run instant.
 */
function nextOccurrence(from, { hourUtc, minuteUtc }) {
  const next = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
      hourUtc,
      minuteUtc,
      0,
      0,
    ),
  );

  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

/**
 * Creates the internal daily scheduler. It uses a native `setTimeout` that is
 * recalculated after every run, so a restart never drifts the daily time.
 * @param {object} [options] - Injectable dependencies.
 * @param {Function} [options.job] - Job runner, defaults to the service.
 * @param {object} [options.logger] - Logger with info/warn/error.
 * @param {object} [options.config] - Resolved config.
 * @param {object} [options.env] - Environment used to detect tests.
 * @param {() => Date} [options.now] - Clock.
 * @param {object} [options.timers] - Timer implementation.
 * @returns {object} Scheduler with start/stop/execute/nextRun.
 */
function createExpireLotsScheduler({
  job = runExpireLotsJob,
  logger = defaultLogger,
  config = loadConfig(process.env, logger),
  env = process.env,
  now = () => new Date(),
  timers = {
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
  },
} = {}) {
  let timer = null;
  let running = false;
  let stopped = false;

  /**
   * Computes the next run from the current instant.
   * @returns {Date} The next run instant.
   */
  function nextRun() {
    return nextOccurrence(now(), config);
  }

  /**
   * Schedules the next run. The timer is unreferenced so it never keeps the
   * process alive by itself.
   * @returns {object|null} The timer handle, or null when scheduling stopped.
   */
  function scheduleNext() {
    if (stopped || !config.enabled) {
      return null;
    }

    const next = nextRun();
    const delay = Math.max(0, next.getTime() - now().getTime());

    timer = timers.setTimeout(() => {
      timer = null;
      return execute();
    }, delay);

    if (typeof timer?.unref === "function") {
      timer.unref();
    }

    logger.info("Expire lots job scheduled", {
      next_run_at: next.toISOString(),
      delay_ms: delay,
    });

    return timer;
  }

  /**
   * Runs the job once, skipping the call when a previous run is still active.
   * Failures are logged with their stack and never stop the scheduler.
   * @returns {Promise<object|null>} The job summary or null.
   */
  async function execute() {
    if (stopped) {
      return null;
    }

    if (running) {
      logger.warn(
        "Expire lots job is still running; skipping overlapping run",
        {},
      );
      return null;
    }

    running = true;

    try {
      return await job();
    } catch (error) {
      logger.error("Expire lots job failed", { stack: error.stack });
      return null;
    } finally {
      running = false;
      scheduleNext();
    }
  }

  /**
   * Starts the scheduler unless it is disabled or running under tests.
   * @returns {object|null} The first timer handle, or null.
   */
  function start() {
    if (!config.enabled) {
      logger.info("Expire lots scheduler disabled", {});
      return null;
    }

    if (env.NODE_ENV === "test") {
      return null;
    }

    return scheduleNext();
  }

  /**
   * Stops the scheduler and clears the pending timer.
   * @returns {void}
   */
  function stop() {
    stopped = true;

    if (timer) {
      timers.clearTimeout(timer);
      timer = null;
    }
  }

  return { execute, nextRun, start, stop };
}

module.exports = { createExpireLotsScheduler, nextOccurrence };
