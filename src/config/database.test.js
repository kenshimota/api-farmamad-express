const fs = require("fs");
const {
  getDatabaseConfig,
  getTestDatabaseName,
  loadEnvironment,
} = require("./database");

const MANAGED_KEYS = [
  "DB_NAME",
  "DB_NAME_TEST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_HOST",
  "DB_PORT",
];

const ORIGINAL_ENV = { ...process.env };

/**
 * Restores the DB_* environment variables mutated by a test.
 * @returns {void}
 */
function restoreEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const key of MANAGED_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }
}

afterEach(restoreEnvironment);

describe("getDatabaseConfig", () => {
  it("reads the DB_* environment variables", () => {
    process.env.DB_NAME = "custom_db";
    process.env.DB_USER = "custom_user";
    process.env.DB_PASSWORD = "custom_password";
    process.env.DB_HOST = "db.example.com";
    process.env.DB_PORT = "6543";

    expect(getDatabaseConfig()).toEqual({
      database: "custom_db",
      username: "custom_user",
      password: "custom_password",
      host: "db.example.com",
      port: 6543,
      dialect: "postgres",
      logging: false,
    });
  });

  it("falls back to the local development defaults", () => {
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;

    expect(getDatabaseConfig()).toEqual({
      database: "bread_king",
      username: "bread_king",
      password: "bread_king",
      host: "localhost",
      port: 5432,
      dialect: "postgres",
      logging: false,
    });
  });

  it("applies overrides on top of the environment config", () => {
    expect(getDatabaseConfig({ database: "other_db" }).database).toBe(
      "other_db",
    );
  });
});

describe("getTestDatabaseName", () => {
  it("prefers DB_NAME_TEST when defined", () => {
    process.env.DB_NAME = "bread_king";
    process.env.DB_NAME_TEST = "custom_test";

    expect(getTestDatabaseName()).toBe("custom_test");
  });

  it("suffixes DB_NAME with _test", () => {
    process.env.DB_NAME = "bread_king";
    delete process.env.DB_NAME_TEST;

    expect(getTestDatabaseName()).toBe("bread_king_test");
  });

  it("does not suffix an already suffixed name twice", () => {
    process.env.DB_NAME = "bread_king_test";
    delete process.env.DB_NAME_TEST;

    expect(getTestDatabaseName()).toBe("bread_king_test");
  });

  it("defaults to bread_king_test when no database name is set", () => {
    delete process.env.DB_NAME;
    delete process.env.DB_NAME_TEST;

    expect(getTestDatabaseName()).toBe("bread_king_test");
  });
});

describe("loadEnvironment", () => {
  it("loads .env without overriding existing variables", () => {
    process.env.DB_NAME = "keep_me";

    loadEnvironment();

    expect(process.env.DB_NAME).toBe("keep_me");
  });

  it("does nothing when the .env file does not exist", () => {
    const existsSync = jest.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(() => loadEnvironment()).not.toThrow();
    expect(existsSync).toHaveBeenCalled();

    existsSync.mockRestore();
  });
});
