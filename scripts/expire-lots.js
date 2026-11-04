#!/usr/bin/env node
"use strict";

const logger = require("../src/config/logger");
const sequelize = require("../src/database");
const {
  createExpireLotsRepository,
} = require("../src/jobs/expire-lots/repository");
const { runExpireLotsJob } = require("../src/jobs/expire-lots/service");

/**
 * Parses the CLI arguments.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {{ dryRun: boolean }} Parsed options.
 */
function parseArgs(argv = process.argv.slice(2)) {
  return { dryRun: argv.includes("--dry-run") };
}

/**
 * Runs the expiration job once and prints its JSON summary on stdout.
 * @param {string[]} [argv] - Arguments after the script name.
 * @returns {Promise<number>} Process exit code.
 */
async function main(argv = process.argv.slice(2)) {
  const { dryRun } = parseArgs(argv);

  try {
    const summary = await runExpireLotsJob({
      repository: createExpireLotsRepository(),
      logger,
      dryRun,
    });

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    return 0;
  } catch (error) {
    logger.error("Expire lots job failed", { stack: error.stack });
    process.stderr.write(
      `${JSON.stringify({ error: error.message }, null, 2)}\n`,
    );

    return 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exit(1);
    });
}

module.exports = { main, parseArgs };
