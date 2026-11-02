"use strict";

const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("../src/config/database");

const ALREADY_EXISTS_CODE = "42P04";

/**
 * Creates the configured database when it does not exist yet.
 * @param {object} [config] - Database config; defaults to the environment config.
 * @param {typeof Sequelize} [AdminSequelize] - Sequelize constructor used for the admin connection.
 * @returns {Promise<boolean>} True when the database was created, false when it already existed.
 */
async function createDatabaseIfMissing(
  config = getDatabaseConfig(),
  AdminSequelize = Sequelize,
) {
  const { database, username, password, ...options } = config;
  const admin = new AdminSequelize("postgres", username, password, options);

  try {
    await admin.getQueryInterface().createDatabase(database);
    return true;
  } catch (error) {
    if (error.original?.code === ALREADY_EXISTS_CODE) {
      return false;
    }
    throw error;
  } finally {
    await admin.close();
  }
}

if (require.main === module) {
  createDatabaseIfMissing()
    .then((created) =>
      console.log(created ? "Database created." : "Database already exists."),
    )
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { createDatabaseIfMissing };
