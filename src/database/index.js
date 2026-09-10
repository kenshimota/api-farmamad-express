const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("../config/database");

const { database, username, password, ...options } = getDatabaseConfig();

const sequelize = new Sequelize(database, username, password, options);

module.exports = sequelize;
