const {
  getDatabaseConfig,
  getTestDatabaseName,
  loadEnvironment,
} = require("./database");

loadEnvironment();

module.exports = {
  development: getDatabaseConfig(),
  test: getDatabaseConfig({ database: getTestDatabaseName() }),
  production: getDatabaseConfig(),
};
