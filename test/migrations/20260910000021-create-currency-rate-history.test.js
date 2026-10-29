const migration = require("../../migrations/20260910000021-create-currency-rate-history");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    INTEGER: "INTEGER",
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATE: "DATE",
    Op: { gt: "GT" },
    literal: jest.fn((value) => value),
  };
}

describe("migration 20260910000021-create-currency-rate-history", () => {
  it("creates the history table without audit timestamps", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "currency_rate_history",
      {
        id: {
          type: "INTEGER",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        currency_id: { type: "INTEGER", allowNull: false },
        previous_rate: { type: "DECIMAL(18,6)", allowNull: true },
        new_rate: { type: "DECIMAL(18,6)", allowNull: false },
        changed_by: { type: "INTEGER", allowNull: true },
        changed_at: {
          type: "DATE",
          allowNull: false,
          defaultValue: "CURRENT_TIMESTAMP",
        },
        reason: { type: "VARCHAR(255)", allowNull: true },
      },
    );

    const columns = queryInterface.createTable.mock.calls[0][1];

    expect(columns).not.toHaveProperty("createdAt");
    expect(columns).not.toHaveProperty("updatedAt");
  });

  it("adds the currency foreign key with RESTRICT", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "currency_rate_history",
      {
        fields: ["currency_id"],
        type: "foreign key",
        name: "currency_rate_history_currency_id_fkey",
        references: { table: "currencies", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
    );
  });

  it("adds the changed_by foreign key with SET NULL", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "currency_rate_history",
      {
        fields: ["changed_by"],
        type: "foreign key",
        name: "currency_rate_history_changed_by_fkey",
        references: { table: "users", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
    );
  });

  it("adds the positive new_rate check and the currency index", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "currency_rate_history",
      {
        fields: ["new_rate"],
        type: "check",
        name: "currency_rate_history_new_rate_positive",
        where: { new_rate: { GT: 0 } },
      },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "currency_rate_history",
      ["currency_id"],
      { name: "currency_rate_history_currency_id_idx" },
    );
  });

  it("drops the history table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith(
      "currency_rate_history",
    );
  });
});
