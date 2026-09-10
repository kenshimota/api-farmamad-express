const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "bread_king",
  process.env.DB_USER || "bread_king",
  process.env.DB_PASSWORD || "bread_king",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
  },
);

module.exports = sequelize;
