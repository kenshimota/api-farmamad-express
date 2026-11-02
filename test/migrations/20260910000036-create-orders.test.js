const migration = require("../../migrations/20260910000036-create-orders");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    TEXT: "TEXT",
    DATE: "DATE",
    literal: jest.fn((value) => value),
    Op: { in: Symbol.for("in"), gte: Symbol.for("gte") },
  };
}

describe("migration 20260910000036-create-orders", () => {
  it("creates the orders table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith("orders", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      number: { type: "INTEGER", allowNull: false },
      customer_id: { type: "INTEGER", allowNull: false },
      user_id: { type: "INTEGER", allowNull: false },
      currency_id: { type: "INTEGER", allowNull: false },
      status: {
        type: "VARCHAR(20)",
        allowNull: false,
        defaultValue: "pending",
      },
      subtotal: { type: "DECIMAL(12,2)", allowNull: false },
      total: { type: "DECIMAL(12,2)", allowNull: false },
      delivery_address: { type: "VARCHAR(500)", allowNull: false },
      notes: { type: "TEXT", allowNull: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the RESTRICT foreign keys, checks and indexes", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    for (const [field, table] of [
      ["customer_id", "customers"],
      ["user_id", "users"],
      ["currency_id", "currencies"],
    ]) {
      expect(queryInterface.addConstraint).toHaveBeenCalledWith("orders", {
        fields: [field],
        type: "foreign key",
        name: `orders_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("orders", {
      fields: ["number"],
      type: "unique",
      name: "orders_number_unique",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("orders", {
      fields: ["status"],
      type: "check",
      name: "orders_status_check",
      where: {
        status: {
          [Sequelize.Op.in]: [
            "pending",
            "confirmed",
            "preparing",
            "shipped",
            "delivered",
            "cancelled",
          ],
        },
      },
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("orders", {
      fields: ["notes"],
      type: "check",
      name: "orders_notes_length_check",
      where: "char_length(notes) <= 1000",
    });

    for (const column of ["customer_id", "status", "createdAt"]) {
      expect(queryInterface.addIndex).toHaveBeenCalledWith("orders", [column], {
        name: `orders_${column}_idx`,
      });
    }
  });

  it("drops the orders table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("orders");
  });
});
