const migration = require("../../migrations/20260910000011-create-states");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `STRING(${length})`),
    DATE: "DATE",
    literal: jest.fn((sql) => `LITERAL:${sql}`),
  };
}

describe("migration 20260910000011-create-states", () => {
  it("creates the states table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("states", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING(100)", allowNull: false },
      code: { type: "STRING(10)", allowNull: false, unique: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds a case-insensitive unique index on the name", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("name")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "states",
      ['LITERAL:LOWER("name")'],
      { unique: true, name: "states_name_lower_unique" },
    );
  });

  it("drops the states table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("states");
  });
});
