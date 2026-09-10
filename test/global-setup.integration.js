const { execFileSync } = require("child_process");
const path = require("path");
const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("../src/config/database");
const { applyIntegrationEnvironment } = require("./helpers/test-database");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATABASE_ALREADY_EXISTS = "42P04";

/**
 * Creates the test database through the Sequelize query interface when it does
 * not exist yet.
 * @param {string} database - Test database name.
 * @returns {Promise<void>}
 */
async function createDatabaseIfMissing(database) {
  const config = getDatabaseConfig();
  const admin = new Sequelize("postgres", config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: "postgres",
    logging: false,
  });

  try {
    await admin.getQueryInterface().createDatabase(database);
  } catch (error) {
    if (error.original?.code !== DATABASE_ALREADY_EXISTS) {
      throw error;
    }
  } finally {
    await admin.close();
  }
}

/**
 * Jest global setup: ensures the test database exists and runs the migrations.
 * @returns {Promise<void>}
 */
module.exports = async () => {
  const testDatabase = applyIntegrationEnvironment();

  await createDatabaseIfMissing(testDatabase);

  execFileSync(
    process.execPath,
    [
      require.resolve("sequelize-cli/lib/sequelize"),
      "db:migrate",
      "--env",
      "test",
    ],
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_ENV: "test" },
      stdio: "inherit",
    },
  );
};
