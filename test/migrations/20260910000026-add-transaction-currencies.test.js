const migration = require("../../migrations/20260910000026-add-transaction-currencies");

const TRANSACTION = { id: "transaction" };

/**
 * Builds the Sequelize type double used by the migration.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
  };
}

/**
 * Builds a query interface double backed by an in-memory default currency.
 * @param {object} [options] - Initial state options.
 * @param {boolean} [options.currencyExists] - Whether USD_BCV exists.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble({ currencyExists = false } = {}) {
  let currencyId = currencyExists ? 3 : null;
  const queryInterface = {
    sequelize: {
      transaction: jest.fn(async (callback) => callback(TRANSACTION)),
    },
    addColumn: jest.fn(),
    changeColumn: jest.fn(),
    removeColumn: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    bulkInsert: jest.fn(async (table, rows) => {
      if (table === "currencies") {
        currencyId = 3;
      }
    }),
    bulkUpdate: jest.fn(),
    rawSelect: jest.fn(async () => currencyId),
  };

  return { queryInterface, state: () => ({ currencyId }) };
}

describe("migration 20260910000026-add-transaction-currencies", () => {
  it("adds the default flag, USD_BCV and the partial unique index", async () => {
    const { queryInterface } = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "currencies",
      "is_default_for_transactions",
      { type: "BOOLEAN", allowNull: false, defaultValue: false },
      { transaction: TRANSACTION },
    );

    const currencyRows = queryInterface.bulkInsert.mock.calls
      .filter((call) => call[0] === "currencies")
      .flatMap((call) => call[1]);
    expect(currencyRows).toEqual([
      expect.objectContaining({
        code: "USD_BCV",
        rate: "889.890000",
        is_active: true,
        is_default_for_transactions: true,
      }),
    ]);

    const historyRows = queryInterface.bulkInsert.mock.calls
      .filter((call) => call[0] === "currency_rate_history")
      .flatMap((call) => call[1]);
    expect(historyRows).toEqual([
      expect.objectContaining({
        currency_id: 3,
        previous_rate: null,
        new_rate: "889.890000",
        changed_by: null,
        reason: "migration",
      }),
    ]);

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "currencies",
      ["is_default_for_transactions"],
      {
        unique: true,
        where: { is_default_for_transactions: true },
        name: "currencies_default_transaction_unique",
        transaction: TRANSACTION,
      },
    );
  });

  it("reuses USD_BCV without duplicating it", async () => {
    const { queryInterface } = queryInterfaceDouble({ currencyExists: true });

    await migration.up(queryInterface, sequelizeDouble());

    const currencyRows = queryInterface.bulkInsert.mock.calls.filter(
      (call) => call[0] === "currencies",
    );
    const historyRows = queryInterface.bulkInsert.mock.calls.filter(
      (call) => call[0] === "currency_rate_history",
    );

    expect(currencyRows).toHaveLength(0);
    expect(historyRows).toHaveLength(0);
    expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
      "currencies",
      { is_active: true, is_default_for_transactions: true },
      { id: 3 },
      { transaction: TRANSACTION },
    );
  });

  it("backfills, requires and references currency_id on costs and purchases", async () => {
    const { queryInterface } = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    for (const table of ["costs", "purchases"]) {
      expect(queryInterface.addColumn).toHaveBeenCalledWith(
        table,
        "currency_id",
        { type: "INTEGER", allowNull: true },
        { transaction: TRANSACTION },
      );
      expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
        table,
        { currency_id: 3 },
        { currency_id: null },
        { transaction: TRANSACTION },
      );
      expect(queryInterface.changeColumn).toHaveBeenCalledWith(
        table,
        "currency_id",
        { type: "INTEGER", allowNull: false },
        { transaction: TRANSACTION },
      );
    }

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("costs", {
      fields: ["currency_id"],
      type: "foreign key",
      name: "costs_currency_id_fkey",
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction: TRANSACTION,
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["currency_id"],
      type: "foreign key",
      name: "purchases_currency_id_fkey",
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction: TRANSACTION,
    });
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "costs",
      ["currency_id"],
      { name: "costs_currency_id_idx", transaction: TRANSACTION },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "purchases",
      ["currency_id"],
      { name: "purchases_currency_id_idx", transaction: TRANSACTION },
    );
  });

  it("removes every column, index and foreign key on rollback", async () => {
    const { queryInterface } = queryInterfaceDouble();

    await migration.down(queryInterface);

    expect(queryInterface.removeConstraint).toHaveBeenCalledWith(
      "purchases",
      "purchases_currency_id_fkey",
      { transaction: TRANSACTION },
    );
    expect(queryInterface.removeConstraint).toHaveBeenCalledWith(
      "costs",
      "costs_currency_id_fkey",
      { transaction: TRANSACTION },
    );
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "currencies",
      "is_default_for_transactions",
      { transaction: TRANSACTION },
    );
  });
});
