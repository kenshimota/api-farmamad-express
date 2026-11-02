"use strict";

const { removeDemo } = require("./lib/demo-catalog/remove");
const { seedDemo } = require("./lib/demo-catalog/seed");

/**
 * Tells whether sequelize-cli invoked this exact seeder explicitly with
 * `--seed`. `npm run db:seed` uses `db:seed:all` and must not load the demo.
 * @param {string[]} [argv] - Process arguments.
 * @returns {boolean} True when the demo seed was requested explicitly.
 */
function shouldRunFromCli(argv = process.argv) {
  return argv.includes("--seed");
}

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    if (!shouldRunFromCli()) {
      return;
    }

    await seedDemo({ queryInterface });
  },

  async down(queryInterface) {
    await removeDemo({ queryInterface });
  },

  shouldRunFromCli,
};
