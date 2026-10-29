const migration = require("../../migrations/20260910000018-create-purchases");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `STRING(${length})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    TEXT: "TEXT",
    DATE: "DATE",
    Op: { in: "IN", gte: "GTE", between: "BETWEEN" },
  };
}

/**
 * Builds the query interface double.
 * @returns {object} Query interface double.
 */
function queryInterface() {
  return {
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
  };
}

describe("migration 20260910000018-create-purchases", () => {
  it("creates the purchases table with its columns", async () => {
    const query = queryInterface();

    expect(typeof migration.up).toBe("function");

    await migration.up(query, sequelizeDouble());

    expect(query.createTable).toHaveBeenCalledTimes(1);
    expect(query.createTable).toHaveBeenCalledWith("purchases", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      number: { type: "INTEGER", allowNull: false },
      supplier_id: { type: "INTEGER", allowNull: false },
      status: {
        type: "STRING(20)",
        allowNull: false,
        defaultValue: "draft",
      },
      subtotal: {
        type: "DECIMAL(12,2)",
        allowNull: false,
        defaultValue: 0,
      },
      tax_rate: {
        type: "DECIMAL(5,2)",
        allowNull: false,
        defaultValue: 16,
      },
      tax_amount: {
        type: "DECIMAL(12,2)",
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: "DECIMAL(12,2)",
        allowNull: false,
        defaultValue: 0,
      },
      notes: { type: "TEXT", allowNull: true },
      confirmed_at: { type: "DATE", allowNull: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the restrictive supplier foreign key and the unique number", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["supplier_id"],
      type: "foreign key",
      name: "purchases_supplier_id_fkey",
      references: { table: "suppliers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["number"],
      type: "unique",
      name: "purchases_number_unique",
    });
  });

  it("adds the status and non-negative/range checks", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["status"],
      type: "check",
      name: "purchases_status_check",
      where: { status: { IN: ["draft", "confirmed", "cancelled"] } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["subtotal"],
      type: "check",
      name: "purchases_subtotal_non_negative",
      where: { subtotal: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["tax_rate"],
      type: "check",
      name: "purchases_tax_rate_range",
      where: { tax_rate: { BETWEEN: [0, 100] } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["tax_amount"],
      type: "check",
      name: "purchases_tax_amount_non_negative",
      where: { tax_amount: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchases", {
      fields: ["total"],
      type: "check",
      name: "purchases_total_non_negative",
      where: { total: { GTE: 0 } },
    });
  });

  it("indexes supplier_id and status", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addIndex).toHaveBeenCalledWith("purchases", ["supplier_id"], {
      name: "purchases_supplier_id_idx",
    });
    expect(query.addIndex).toHaveBeenCalledWith("purchases", ["status"], {
      name: "purchases_status_idx",
    });
  });

  it("drops the table when rolling back", async () => {
    const query = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(query);

    expect(query.dropTable).toHaveBeenCalledWith("purchases");
  });
});
