const migration = require("../../migrations/20260910000039-create-order-history");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    JSONB: "JSONB",
    DATE: "DATE",
    Op: { in: Symbol.for("in") },
  };
}

describe("migration 20260910000039-create-order-history", () => {
  it("creates the order_history table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledWith("order_history", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      order_id: { type: "INTEGER", allowNull: false },
      event_type: { type: "VARCHAR(30)", allowNull: false },
      from_status: { type: "VARCHAR(20)", allowNull: true },
      to_status: { type: "VARCHAR(20)", allowNull: true },
      actor_user_id: { type: "INTEGER", allowNull: true },
      metadata: { type: "JSONB", allowNull: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the foreign keys, event check and history index", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_history", {
      fields: ["order_id"],
      type: "foreign key",
      name: "order_history_order_id_fkey",
      references: { table: "orders", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_history", {
      fields: ["actor_user_id"],
      type: "foreign key",
      name: "order_history_actor_user_id_fkey",
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_history", {
      fields: ["event_type"],
      type: "check",
      name: "order_history_event_type_check",
      where: {
        event_type: {
          [Sequelize.Op.in]: [
            "created",
            "item_added",
            "item_updated",
            "item_removed",
            "status_changed",
            "invoice_issued",
          ],
        },
      },
    });
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "order_history",
      ["order_id", "createdAt", "id"],
      { name: "order_history_order_created_id_idx" },
    );
  });

  it("drops the order_history table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("order_history");
  });
});
