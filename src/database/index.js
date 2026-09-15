const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("../config/database");
const { isQueryLoggingEnabled, logQuery } = require("../config/logger/sql");

const { database, username, password, ...options } = getDatabaseConfig();

const queryLogging = isQueryLoggingEnabled();

const sequelize = new Sequelize(database, username, password, {
  ...options,
  logging: queryLogging ? logQuery : options.logging,
  benchmark: queryLogging,
});

module.exports = sequelize;
