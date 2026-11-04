const app = require("./app");
const logger = require("./config/logger");
const { createExpireLotsScheduler } = require("./jobs/expire-lots/scheduler");

const port = process.env.PORT || 3001;
const scheduler = createExpireLotsScheduler();

const server = app.listen(port, () => {
  logger.info(`API listening on port ${port}`);
});

scheduler.start();

let shuttingDown = false;

/**
 * Stops the daily scheduler and closes the HTTP server gracefully.
 * @param {string} signal - Received signal name.
 * @returns {void}
 */
function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Shutting down", { signal });
  scheduler.stop();

  server.close(() => {
    logger.info("API stopped");
    process.exit(0);
  });

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref?.();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
