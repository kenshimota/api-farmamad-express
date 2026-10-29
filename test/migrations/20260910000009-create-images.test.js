const migration = require("../../migrations/20260910000009-create-images");

describe("migration 20260910000009-create-images", () => {
  it("creates the images table with its columns and constraints", async () => {
    const queryInterface = { createTable: jest.fn() };
    const Sequelize = {
      INTEGER: "INTEGER",
      STRING: jest.fn((length) => `STRING(${length})`),
      DATE: "DATE",
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("images", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      url: { type: "STRING(2048)", allowNull: false },
      pathname: {
        type: "STRING(2048)",
        allowNull: true,
        defaultValue: null,
      },
      reference: { type: "STRING(100)", allowNull: false, unique: true },
      thumbnail: { type: "STRING(2048)", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("drops the images table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("images");
  });
});
