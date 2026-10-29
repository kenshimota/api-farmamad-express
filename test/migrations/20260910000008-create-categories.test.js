const migration = require("../../migrations/20260910000008-create-categories");

describe("migration 20260910000008-create-categories", () => {
  it("creates the categories table with its columns and constraints", async () => {
    const queryInterface = { createTable: jest.fn() };
    const Sequelize = {
      INTEGER: "INTEGER",
      STRING: jest.fn((length) => `STRING(${length})`),
      DATE: "DATE",
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("categories", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING(100)", allowNull: false, unique: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("drops the categories table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("categories");
  });
});
