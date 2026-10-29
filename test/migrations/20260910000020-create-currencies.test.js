const migration = require("../../migrations/20260910000020-create-currencies");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    INTEGER: "INTEGER",
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    BOOLEAN: "BOOLEAN",
    DATE: "DATE",
    Op: { gt: "GT", gte: "GTE" },
    literal: jest.fn((value) => value),
  };
}

describe("migration 20260910000020-create-currencies", () => {
  it("creates the currencies table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith("currencies", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: { type: "VARCHAR(10)", allowNull: false },
      name: { type: "VARCHAR(100)", allowNull: false },
      symbol: { type: "VARCHAR(10)", allowNull: false },
      rate: { type: "DECIMAL(18,6)", allowNull: false },
      is_base: { type: "BOOLEAN", allowNull: false, defaultValue: false },
      is_active: { type: "BOOLEAN", allowNull: false, defaultValue: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds a positive rate check", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("currencies", {
      fields: ["rate"],
      type: "check",
      name: "currencies_rate_positive",
      where: { rate: { GT: 0 } },
    });
  });

  it("adds a case-insensitive unique index for the code", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("code")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "currencies",
      ['LOWER("code")'],
      {
        unique: true,
        name: "currencies_code_lower_unique",
      },
    );
  });

  it("adds the partial unique index that allows only one base currency", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "currencies",
      ["is_base"],
      {
        unique: true,
        where: { is_base: true },
        name: "currencies_base_unique",
      },
    );
  });

  it("drops the currencies table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("currencies");
  });
});
