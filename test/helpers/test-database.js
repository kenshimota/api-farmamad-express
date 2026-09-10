const {
  getTestDatabaseName,
  loadEnvironment,
} = require("../../src/config/database");

/**
 * Aborts the test run when the target database is not a test database.
 * @param {string} name - Database name resolved from the environment.
 * @returns {string} The validated database name.
 * @throws {Error} When the name does not end with "_test".
 */
function assertTestDatabase(name) {
  if (typeof name !== "string" || !name.endsWith("_test")) {
    throw new Error(
      `Refusing to run against "${name}": the database name must end with "_test".`,
    );
  }

  return name;
}

/**
 * Prepares the process environment for the integration suite: loads .env,
 * points DB_NAME to the test database and makes sure the host reaches the
 * dockerized Postgres from outside the compose network.
 * @returns {string} The validated test database name.
 */
function applyIntegrationEnvironment() {
  loadEnvironment();

  process.env.DB_NAME = assertTestDatabase(getTestDatabaseName());
  process.env.DB_HOST = process.env.DB_HOST_TEST || "localhost";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

  return process.env.DB_NAME;
}

module.exports = { applyIntegrationEnvironment, assertTestDatabase };
