const migration = require("../../migrations/20260910000005-create-customers");

describe("migration 20260910000005-create-customers", () => {
  it("creates the customers table with its columns and constraints", async () => {
    const queryInterface = { createTable: jest.fn() };
    const Sequelize = {
      INTEGER: "INTEGER",
      STRING: "STRING",
      DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
      BOOLEAN: "BOOLEAN",
      DATE: "DATE",
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("customers", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fullName: { type: "STRING", allowNull: false },
      latitude: { type: "DECIMAL(10,7)", allowNull: false },
      longitude: { type: "DECIMAL(10,7)", allowNull: false },
      direction: { type: "STRING", allowNull: false },
      email: { type: "STRING", allowNull: false, unique: true },
      isRegistered: {
        type: "BOOLEAN",
        allowNull: false,
        defaultValue: false,
      },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("drops the customers table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("customers");
  });
});
