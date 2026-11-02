const migration = require("../../migrations/20260910000031-create-price-lists");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => (length ? `STRING(${length})` : "STRING")),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATE: "DATE",
    literal: jest.fn((value) => value),
    Op: { gte: "GTE", lt: "LT" },
  };
}

/**
 * Builds a query interface double that records every call.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    createTable: jest.fn(),
    addColumn: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
    removeConstraint: jest.fn(),
    removeIndex: jest.fn(),
    removeColumn: jest.fn(),
    dropTable: jest.fn(),
  };
}

describe("migration 20260910000031-create-price-lists", () => {
  it("creates the price_lists table with its columns", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith("price_lists", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING(150)", allowNull: false },
      description: { type: "STRING(500)", allowNull: true, defaultValue: null },
      percentage: { type: "DECIMAL(5,2)", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the percentage range check and the case-insensitive unique index", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("price_lists", {
      fields: ["percentage"],
      type: "check",
      name: "price_lists_percentage_range",
      where: { percentage: { GTE: 0, LT: 100 } },
    });
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "price_lists",
      [Sequelize.literal('LOWER("name")')],
      { unique: true, name: "price_lists_name_lower_unique" },
    );
  });

  it("adds customers.price_list_id with its foreign key and index", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "customers",
      "price_list_id",
      { type: "INTEGER", allowNull: true },
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("customers", {
      fields: ["price_list_id"],
      type: "foreign key",
      name: "customers_price_list_id_fkey",
      references: { table: "price_lists", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "customers",
      ["price_list_id"],
      { name: "customers_price_list_id_idx" },
    );
  });

  it("removes the customer column before dropping the table on rollback", async () => {
    const queryInterface = queryInterfaceDouble();

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.removeConstraint).toHaveBeenCalledWith(
      "customers",
      "customers_price_list_id_fkey",
    );
    expect(queryInterface.removeIndex).toHaveBeenCalledWith(
      "customers",
      "customers_price_list_id_idx",
    );
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "customers",
      "price_list_id",
    );
    expect(queryInterface.dropTable).toHaveBeenCalledWith("price_lists");

    const constraintOrder =
      queryInterface.removeConstraint.mock.invocationCallOrder[0];
    const indexOrder = queryInterface.removeIndex.mock.invocationCallOrder[0];
    const columnOrder = queryInterface.removeColumn.mock.invocationCallOrder[0];
    const tableOrder = queryInterface.dropTable.mock.invocationCallOrder[0];

    expect(constraintOrder).toBeLessThan(indexOrder);
    expect(indexOrder).toBeLessThan(columnOrder);
    expect(columnOrder).toBeLessThan(tableOrder);
  });
});
