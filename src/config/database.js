const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Loads the local .env file when present. Existing environment variables are
 * preserved, so container or CI values always win.
 * @returns {void}
 */
function loadEnvironment() {
  const envFile = path.join(PROJECT_ROOT, ".env");

  if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

/**
 * Builds the Postgres connection options from the DB_* environment variables.
 * @param {object} [overrides] - Values that override the resolved config.
 * @returns {{ database: string, username: string, password: string,
 *   host: string, port: number, dialect: string, logging: boolean }}
 *   The Sequelize connection config.
 */
function getDatabaseConfig(overrides = {}) {
  return {
    database: process.env.DB_NAME || "bread_king",
    username: process.env.DB_USER || "bread_king",
    password: process.env.DB_PASSWORD || "bread_king",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
    ...overrides,
  };
}

/**
 * Resolves the database used by the integration suite. The resolution is
 * idempotent, so an already suffixed name is not suffixed twice.
 * @returns {string} DB_NAME_TEST or "<DB_NAME>_test".
 */
function getTestDatabaseName() {
  const baseName = process.env.DB_NAME || "bread_king";

  if (process.env.DB_NAME_TEST) {
    return process.env.DB_NAME_TEST;
  }

  return baseName.endsWith("_test") ? baseName : `${baseName}_test`;
}

module.exports = { getDatabaseConfig, getTestDatabaseName, loadEnvironment };
