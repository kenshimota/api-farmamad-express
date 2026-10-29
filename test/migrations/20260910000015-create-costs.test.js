const migration = require("../../migrations/20260910000015-create-costs");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATE: "DATE",
    Op: { gte: "GTE" },
  };
}

describe("migration 20260910000015-create-costs", () => {
  it("creates the costs table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("costs", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      product_id: { type: "INTEGER", allowNull: false },
      item_state_id: { type: "INTEGER", allowNull: false },
      cost: { type: "DECIMAL(12,2)", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds restrictive foreign keys to products and item states", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("costs", {
      fields: ["product_id"],
      type: "foreign key",
      name: "costs_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("costs", {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "costs_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds the unique combination and the non-negative check", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("costs", {
      fields: ["product_id", "item_state_id"],
      type: "unique",
      name: "costs_product_id_item_state_id_unique",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("costs", {
      fields: ["cost"],
      type: "check",
      name: "costs_cost_non_negative",
      where: { cost: { GTE: 0 } },
    });
  });

  it("drops the costs table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("costs");
  });
});
