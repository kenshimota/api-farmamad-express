#!/usr/bin/env node
"use strict";

const { loadEnvironment } = require("../src/config/database");

loadEnvironment();

const sequelize = require("../src/database");
const { removeDemo } = require("../seeders/lib/demo-catalog/remove");

/**
 * Removes the demo catalog without touching real rows. It exists because the
 * project does not use sequelize-cli's seeder storage, so its generic
 * `db:seed:undo` command cannot find explicit seeders.
 * @returns {Promise<void>} Resolves after the removal.
 */
async function main() {
  const result = await removeDemo({
    queryInterface: sequelize.getQueryInterface(),
  });

  console.log(
    `Demo catalog removed: ${result.products} products, ${result.images} images, ${result.lots} lots.`,
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Could not remove the demo catalog: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { main };
