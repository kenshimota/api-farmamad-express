jest.mock("sequelize", () => ({ Sequelize: jest.fn() }));

jest.mock("../config/database", () => ({
  getDatabaseConfig: jest.fn(() => ({
    database: "bread_king",
    username: "bread_king",
    password: "bread_king",
    host: "localhost",
    port: 5432,
    dialect: "postgres",
    logging: false,
  })),
}));

/**
 * Loads a fresh `src/database` instance under the given NODE_ENV so the
 * Sequelize constructor options can be inspected.
 *
 * @param {string} env
 * @returns {{ Sequelize: jest.Mock, logQuery: Function }}
 */
function loadDatabase(env) {
  process.env.NODE_ENV = env;
  jest.resetModules();

  const { Sequelize } = require("sequelize");
  const { logQuery } = require("../config/logger/sql");

  require("./index");

  return { Sequelize, logQuery };
}

describe("database connection", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = original;
    }
  });

  it("enables colour-coded query logging with benchmark in development", () => {
    const { Sequelize, logQuery } = loadDatabase("development");

    const options = Sequelize.mock.calls[0][3];
    expect(options.logging).toBe(logQuery);
    expect(options.benchmark).toBe(true);
  });

  it("keeps query logging disabled outside development", () => {
    const { Sequelize } = loadDatabase("test");

    const options = Sequelize.mock.calls[0][3];
    expect(options.logging).toBe(false);
    expect(options.benchmark).toBe(false);
  });
});
