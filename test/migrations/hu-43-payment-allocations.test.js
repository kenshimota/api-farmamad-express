const allocationsMigration = require("../../migrations/20260910000035-create-payment-allocations");
const walletFkMigration = require("../../migrations/20260910000036-add-payment-allocation-fk-to-wallet-transactions");
const invoiceInvariantsMigration = require("../../migrations/20260910000037-add-invoice-payment-invariants");

/**
 * Builds the Sequelize type double used by the migrations.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    DATE: "DATE",
    STRING: jest.fn((length) => `STRING(${length})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    literal: jest.fn((sql) => `LITERAL:${sql}`),
    Op: { gt: "GT", gte: "GTE", ne: "NE", in: "IN" },
  };
}

/**
 * Builds a query interface double.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    addColumn: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
    createTable: jest.fn(),
    dropTable: jest.fn(),
    removeColumn: jest.fn(),
    removeConstraint: jest.fn(),
    removeIndex: jest.fn(),
  };
}

describe("migration HU-43 payment_allocations", () => {
  it("creates every documented column with its defaults", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await allocationsMigration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith(
      "payment_allocations",
      expect.objectContaining({
        id: {
          type: "INTEGER",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        payment_id: { type: "INTEGER", allowNull: false },
        invoice_id: { type: "INTEGER", allowNull: false },
        amount: { type: "DECIMAL(14,2)", allowNull: false },
        applied_amount: { type: "DECIMAL(12,2)", allowNull: false },
        exchange_rate: { type: "DECIMAL(18,6)", allowNull: false },
        allocated_at: expect.objectContaining({
          type: "DATE",
          allowNull: false,
        }),
        created_by_user_id: { type: "INTEGER", allowNull: false },
        createdAt: { type: "DATE", allowNull: false },
        updatedAt: { type: "DATE", allowNull: false },
      }),
    );
    expect(query.createTable.mock.calls[0][1].allocated_at.defaultValue).toBe(
      "LITERAL:CURRENT_TIMESTAMP",
    );
  });

  it("adds the payment, invoice and author foreign keys", async () => {
    const query = queryInterfaceDouble();

    await allocationsMigration.up(query, sequelizeDouble());

    for (const [field, table] of [
      ["payment_id", "payments"],
      ["invoice_id", "invoices"],
      ["created_by_user_id", "users"],
    ]) {
      expect(query.addConstraint).toHaveBeenCalledWith("payment_allocations", {
        fields: [field],
        type: "foreign key",
        name: `payment_allocations_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }
  });

  it("adds the positive amount, applied amount and rate checks", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await allocationsMigration.up(query, Sequelize);

    expect(query.addConstraint).toHaveBeenCalledWith("payment_allocations", {
      fields: ["amount"],
      type: "check",
      name: "payment_allocations_amount_positive",
      where: { amount: { GT: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("payment_allocations", {
      fields: ["applied_amount"],
      type: "check",
      name: "payment_allocations_applied_amount_positive",
      where: { applied_amount: { GT: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("payment_allocations", {
      fields: ["exchange_rate"],
      type: "check",
      name: "payment_allocations_exchange_rate_positive",
      where: { exchange_rate: { GT: 0 } },
    });
  });

  it("prevents applying one payment twice to the same invoice", async () => {
    const query = queryInterfaceDouble();

    await allocationsMigration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("payment_allocations", {
      fields: ["payment_id", "invoice_id"],
      type: "unique",
      name: "payment_allocations_payment_invoice_unique",
    });
  });

  it("indexes both foreign keys and drops the table on rollback", async () => {
    const query = queryInterfaceDouble();

    await allocationsMigration.up(query, sequelizeDouble());

    expect(query.addIndex).toHaveBeenCalledWith(
      "payment_allocations",
      ["payment_id"],
      { name: "payment_allocations_payment_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith(
      "payment_allocations",
      ["invoice_id"],
      { name: "payment_allocations_invoice_id_idx" },
    );

    await allocationsMigration.down(query);
    expect(query.dropTable).toHaveBeenCalledWith("payment_allocations");
  });
});

describe("migration HU-43 wallet_transactions linkage", () => {
  it("adds the RESTRICT foreign key and the unique allocation index", async () => {
    const query = queryInterfaceDouble();

    await walletFkMigration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("wallet_transactions", {
      fields: ["payment_allocation_id"],
      type: "foreign key",
      name: "wallet_transactions_payment_allocation_id_fkey",
      references: { table: "payment_allocations", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "wallet_transactions",
      ["payment_allocation_id"],
      {
        unique: true,
        name: "wallet_transactions_payment_allocation_unique",
      },
    );
  });

  it("removes the index and constraint without dropping the column", async () => {
    const query = queryInterfaceDouble();

    await walletFkMigration.down(query);

    expect(query.removeIndex).toHaveBeenCalledWith(
      "wallet_transactions",
      "wallet_transactions_payment_allocation_unique",
    );
    expect(query.removeConstraint).toHaveBeenCalledWith(
      "wallet_transactions",
      "wallet_transactions_payment_allocation_id_fkey",
    );
    expect(query.removeColumn).not.toHaveBeenCalled();
  });
});

describe("migration HU-43 invoice payment invariants", () => {
  it("enforces paid_amount <= total and indexes payment_status", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await invoiceInvariantsMigration.up(query, Sequelize);

    expect(query.addConstraint).toHaveBeenCalledWith("invoices", {
      fields: ["paid_amount"],
      type: "check",
      name: "invoices_paid_amount_within_total",
      where: "LITERAL:paid_amount <= total",
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "invoices",
      ["payment_status"],
      {
        name: "invoices_payment_status_idx",
      },
    );
  });

  it("is reversible", async () => {
    const query = queryInterfaceDouble();

    await invoiceInvariantsMigration.down(query);

    expect(query.removeIndex).toHaveBeenCalledWith(
      "invoices",
      "invoices_payment_status_idx",
    );
    expect(query.removeConstraint).toHaveBeenCalledWith(
      "invoices",
      "invoices_paid_amount_within_total",
    );
  });
});
