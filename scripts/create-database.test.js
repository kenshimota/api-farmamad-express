"use strict";

const { createDatabaseIfMissing } = require("./create-database");

const CONFIG = {
  database: "bread_king",
  username: "bread_king",
  password: "bread_king",
  host: "localhost",
  port: 5432,
  dialect: "postgres",
  logging: false,
};

/**
 * Builds a fake Sequelize constructor and admin connection.
 * @param {Function} [createDatabase] - Query interface createDatabase implementation.
 * @returns {{ AdminSequelize: Function, createDatabase: Function, close: Function }} Fakes.
 */
function fakeSequelize(createDatabase = jest.fn().mockResolvedValue()) {
  const close = jest.fn().mockResolvedValue();
  const admin = {
    getQueryInterface: () => ({ createDatabase }),
    close,
  };
  const AdminSequelize = jest.fn(() => admin);

  return { AdminSequelize, createDatabase, close };
}

describe("createDatabaseIfMissing", () => {
  it("creates the database when it does not exist", async () => {
    const fake = fakeSequelize();

    await expect(
      createDatabaseIfMissing(CONFIG, fake.AdminSequelize),
    ).resolves.toBe(true);

    expect(fake.AdminSequelize).toHaveBeenCalledWith(
      "postgres",
      "bread_king",
      "bread_king",
      expect.objectContaining({ host: "localhost", port: 5432 }),
    );
    expect(fake.createDatabase).toHaveBeenCalledWith("bread_king");
    expect(fake.close).toHaveBeenCalled();
  });

  it("returns false when the database already exists", async () => {
    const error = Object.assign(new Error("exists"), {
      original: { code: "42P04" },
    });
    const fake = fakeSequelize(jest.fn().mockRejectedValue(error));

    await expect(
      createDatabaseIfMissing(CONFIG, fake.AdminSequelize),
    ).resolves.toBe(false);

    expect(fake.close).toHaveBeenCalled();
  });

  it("rethrows unexpected errors and closes the admin connection", async () => {
    const error = new Error("boom");
    const fake = fakeSequelize(jest.fn().mockRejectedValue(error));

    await expect(
      createDatabaseIfMissing(CONFIG, fake.AdminSequelize),
    ).rejects.toBe(error);

    expect(fake.close).toHaveBeenCalled();
  });
});
