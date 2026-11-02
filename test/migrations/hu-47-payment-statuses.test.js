const statusesMigration = require("../../migrations/20260910000046-create-payment-statuses");
const historyMigration = require("../../migrations/20260910000047-create-payment-status-history");
const paymentsMigration = require("../../migrations/20260910000048-add-status-and-reference-image-to-payments");

/**
 * Builds the Sequelize type double used by the migrations.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
    DATE: "DATE",
    JSONB: "JSONB",
    STRING: jest.fn((length) => `STRING(${length})`),
    literal: jest.fn((sql) => `LITERAL:${sql}`),
    Op: { gte: "GTE", in: "IN" },
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
    bulkInsert: jest.fn(),
    changeColumn: jest.fn(),
    createTable: jest.fn(),
    dropTable: jest.fn(),
    removeColumn: jest.fn(),
    removeConstraint: jest.fn(),
    removeIndex: jest.fn(),
    sequelize: { query: jest.fn() },
  };
}

describe("migration HU-47", () => {
  it("creates payment_statuses and seeds the three base codes", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await statusesMigration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith(
      "payment_statuses",
      expect.objectContaining({
        code: { type: "STRING(20)", allowNull: false },
        name: { type: "STRING(100)", allowNull: false },
        description: { type: "STRING(255)", allowNull: true },
        sort_order: { type: "INTEGER", allowNull: false },
        is_system: {
          type: "BOOLEAN",
          allowNull: false,
          defaultValue: false,
        },
      }),
    );
    expect(query.addConstraint).toHaveBeenCalledWith("payment_statuses", {
      fields: ["code"],
      type: "check",
      name: "payment_statuses_code_format",
      where: "LITERAL:code ~ '^[a-z][a-z0-9_]{1,19}$'",
    });
    expect(query.bulkInsert).toHaveBeenCalledWith(
      "payment_statuses",
      expect.arrayContaining([
        expect.objectContaining({ code: "pending", name: "Pendiente" }),
        expect.objectContaining({
          code: "conciliated",
          name: "Conciliado",
        }),
        expect.objectContaining({ code: "rejected", name: "Rechazado" }),
      ]),
      { ignoreDuplicates: true },
    );

    await statusesMigration.down(query);
    expect(query.dropTable).toHaveBeenCalledWith("payment_statuses");
  });

  it("creates the append-only history with its foreign keys and index", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await historyMigration.up(query, Sequelize);

    expect(query.createTable).toHaveBeenCalledWith(
      "payment_status_history",
      expect.objectContaining({
        payment_id: { type: "INTEGER", allowNull: false },
        from_status: { type: "STRING(20)", allowNull: true },
        to_status: { type: "STRING(20)", allowNull: false },
        reason: { type: "STRING(500)", allowNull: true },
        actor_user_id: { type: "INTEGER", allowNull: false },
        metadata: { type: "JSONB", allowNull: true },
      }),
    );
    expect(query.addConstraint).toHaveBeenCalledWith("payment_status_history", {
      fields: ["payment_id"],
      type: "foreign key",
      name: "payment_status_history_payment_id_fkey",
      references: { table: "payments", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "payment_status_history",
      ["payment_id", "createdAt", "id"],
      { name: "payment_status_history_payment_created_idx" },
    );

    await historyMigration.down(query);
    expect(query.dropTable).toHaveBeenCalledWith("payment_status_history");
  });

  it("adds the payment status, reason and reference image with the backfill", async () => {
    const query = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await paymentsMigration.up(query, Sequelize);

    expect(query.addColumn).toHaveBeenCalledWith("payments", "status", {
      type: "STRING(20)",
      allowNull: false,
      defaultValue: "pending",
    });
    expect(query.addColumn).toHaveBeenCalledWith(
      "payments",
      "rejection_reason",
      {
        type: "STRING(500)",
        allowNull: true,
      },
    );
    expect(query.addColumn).toHaveBeenCalledWith(
      "payments",
      "reference_image_id",
      { type: "INTEGER", allowNull: true },
    );
    expect(query.addConstraint).toHaveBeenCalledWith("payments", {
      fields: ["status"],
      type: "foreign key",
      name: "payments_status_fkey",
      references: { table: "payment_statuses", field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("payments", {
      fields: ["status", "rejection_reason"],
      type: "check",
      name: "payments_rejected_reason_required",
      where: "LITERAL:status <> 'rejected' OR rejection_reason IS NOT NULL",
    });
    expect(query.addIndex).toHaveBeenCalledWith("payments", ["status"], {
      name: "payments_status_idx",
    });
    expect(query.addIndex).toHaveBeenCalledWith(
      "payments",
      ["reference_image_id"],
      { name: "payments_reference_image_id_idx" },
    );
    expect(query.sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("conciliated"),
    );

    await paymentsMigration.down(query);
    expect(query.removeColumn).toHaveBeenCalledWith(
      "payments",
      "reference_image_id",
    );
  });
});
