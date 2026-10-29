const migration = require("../../migrations/20260910000016-create-stocks");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    DATE: "DATE",
    Op: { gte: "GTE" },
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

describe("migration 20260910000016-create-stocks", () => {
  it("creates the stocks table with its columns", async () => {
    const query = queryInterface();

    expect(typeof migration.up).toBe("function");

    await migration.up(query, sequelizeDouble());

    expect(query.createTable).toHaveBeenCalledTimes(1);
    expect(query.createTable).toHaveBeenCalledWith("stocks", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      product_id: { type: "INTEGER", allowNull: false },
      item_state_id: { type: "INTEGER", allowNull: false },
      quantity: { type: "INTEGER", allowNull: false, defaultValue: 0 },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds restrictive foreign keys to products and item states", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("stocks", {
      fields: ["product_id"],
      type: "foreign key",
      name: "stocks_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("stocks", {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "stocks_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds the unique combination and the non-negative check", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("stocks", {
      fields: ["product_id", "item_state_id"],
      type: "unique",
      name: "stocks_product_id_item_state_id_unique",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("stocks", {
      fields: ["quantity"],
      type: "check",
      name: "stocks_quantity_non_negative",
      where: { quantity: { GTE: 0 } },
    });
  });

  it("indexes both foreign keys", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addIndex).toHaveBeenCalledWith("stocks", ["product_id"], {
      name: "stocks_product_id_idx",
    });
    expect(query.addIndex).toHaveBeenCalledWith("stocks", ["item_state_id"], {
      name: "stocks_item_state_id_idx",
    });
  });

  it("drops the stocks table when rolling back", async () => {
    const query = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(query);

    expect(query.dropTable).toHaveBeenCalledTimes(1);
    expect(query.dropTable).toHaveBeenCalledWith("stocks");
  });
});
