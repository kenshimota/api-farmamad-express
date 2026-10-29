const migration = require("../../migrations/20260910000012-create-cities");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `STRING(${length})`),
    DATE: "DATE",
  };
}

/**
 * Builds the query interface double used by the migration.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
  };
}

describe("migration 20260910000012-create-cities", () => {
  it("creates the cities table with its columns", async () => {
    const queryInterface = queryInterfaceDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("cities", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING(100)", allowNull: false },
      state_id: { type: "INTEGER", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds a restrictive state foreign key", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("cities", {
      fields: ["state_id"],
      type: "foreign key",
      name: "cities_state_id_fkey",
      references: { table: "states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds the composite unique index and the foreign key index", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "cities",
      ["name", "state_id"],
      { unique: true, name: "cities_name_state_id_unique" },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith("cities", [
      "state_id",
    ]);
  });

  it("drops the cities table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("cities");
  });
});
