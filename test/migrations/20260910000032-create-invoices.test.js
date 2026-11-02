const migration = require("../../migrations/20260910000032-create-invoices");

function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `STRING(${length})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    TEXT: "TEXT",
    DATE: "DATE",
    DATEONLY: "DATEONLY",
    literal: jest.fn((value) => ({ literal: value })),
    Op: { in: "IN", gte: "GTE", lte: "LTE" },
  };
}

function queryInterface() {
  return {
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
  };
}

describe("migration 20260910000032-create-invoices", () => {
  it("creates the invoices table with the documented columns", async () => {
    const query = queryInterface();
    const Sequelize = sequelizeDouble();

    await migration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith("invoices", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      number: { type: "INTEGER", allowNull: false },
      order_id: { type: "INTEGER", allowNull: true },
      customer_id: { type: "INTEGER", allowNull: false },
      invoiced_by_user_id: { type: "INTEGER", allowNull: false },
      currency_id: { type: "INTEGER", allowNull: false },
      payment_term_id: { type: "INTEGER", allowNull: true },
      subtotal: {
        type: "DECIMAL(12,2)",
        allowNull: false,
        defaultValue: 0,
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
      paid_amount: {
        type: "DECIMAL(12,2)",
        allowNull: false,
        defaultValue: 0,
      },
      payment_status: {
        type: "STRING(20)",
        allowNull: false,
        defaultValue: "pending",
      },
      issued_at: {
        type: "DATE",
        allowNull: false,
        defaultValue: { literal: "CURRENT_TIMESTAMP" },
      },
      due_date: { type: "DATEONLY", allowNull: false },
      notes: { type: "TEXT", allowNull: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the unique number and order and the required foreign keys", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["number"],
      type: "unique",
      name: "invoices_number_unique",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["order_id"],
      type: "unique",
      name: "invoices_order_id_unique",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["customer_id"],
      type: "foreign key",
      name: "invoices_customer_id_fkey",
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["invoiced_by_user_id"],
      type: "foreign key",
      name: "invoices_invoiced_by_user_id_fkey",
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["currency_id"],
      type: "foreign key",
      name: "invoices_currency_id_fkey",
      references: { table: "currencies", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("does not add the order or payment term foreign keys", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    const references = query.addConstraint.mock.calls
      .map(([, constraint]) => constraint.references?.table)
      .filter(Boolean);

    expect(references).not.toContain("orders");
    expect(references).not.toContain("payment_terms");
  });

  it("adds the status, amount and notes checks", async () => {
    const query = queryInterface();
    const Sequelize = sequelizeDouble();

    await migration.up(query, Sequelize);

    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["payment_status"],
      type: "check",
      name: "invoices_payment_status_check",
      where: { payment_status: { IN: ["pending", "partial", "paid"] } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["subtotal"],
      type: "check",
      name: "invoices_subtotal_non_negative",
      where: { subtotal: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["tax_amount"],
      type: "check",
      name: "invoices_tax_amount_non_negative",
      where: { tax_amount: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["total"],
      type: "check",
      name: "invoices_total_non_negative",
      where: { total: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["paid_amount"],
      type: "check",
      name: "invoices_paid_amount_non_negative",
      where: { paid_amount: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["notes"],
      type: "check",
      name: "invoices_notes_length_check",
      where: { literal: "char_length(notes) <= 1000" },
    });
  });

  it("indexes the query columns and drops the table on rollback", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addIndex).toHaveBeenCalledWith("invoices", ["customer_id"], {
      name: "invoices_customer_id_idx",
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "invoices",
      ["invoiced_by_user_id"],
      { name: "invoices_invoiced_by_user_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith(
      "invoices",
      ["payment_term_id"],
      { name: "invoices_payment_term_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith("invoices", ["issued_at"], {
      name: "invoices_issued_at_idx",
    });

    const down = { dropTable: jest.fn() };
    await migration.down(down);
    expect(down.dropTable).toHaveBeenCalledWith("invoices");
  });
});
