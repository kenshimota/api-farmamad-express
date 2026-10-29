const migration = require("../../migrations/20260910000007-create-warehouses");

describe("migration 20260910000007-create-warehouses", () => {
  it("creates the warehouses table with its columns and constraints", async () => {
    const queryInterface = { createTable: jest.fn() };
    const Sequelize = {
      INTEGER: "INTEGER",
      STRING: "STRING",
      TEXT: "TEXT",
      DATE: "DATE",
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("warehouses", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING", allowNull: false },
      observations: {
        type: "TEXT",
        allowNull: true,
        defaultValue: null,
      },
      address: { type: "STRING", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("drops the warehouses table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("warehouses");
  });
});
