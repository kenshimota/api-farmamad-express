const migration = require("../../migrations/20260910000019-create-purchase-items");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATE: "DATE",
    Op: { gt: "GT", gte: "GTE" },
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

describe("migration 20260910000019-create-purchase-items", () => {
  it("creates the purchase_items table with its columns", async () => {
    const query = queryInterface();

    expect(typeof migration.up).toBe("function");

    await migration.up(query, sequelizeDouble());

    expect(query.createTable).toHaveBeenCalledWith("purchase_items", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      purchase_id: { type: "INTEGER", allowNull: false },
      product_id: { type: "INTEGER", allowNull: false },
      item_state_id: { type: "INTEGER", allowNull: false },
      quantity: { type: "INTEGER", allowNull: false },
      unit_cost: { type: "DECIMAL(12,2)", allowNull: false },
      subtotal: { type: "DECIMAL(12,2)", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the cascade purchase and restrictive reference foreign keys", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["purchase_id"],
      type: "foreign key",
      name: "purchase_items_purchase_id_fkey",
      references: { table: "purchases", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["product_id"],
      type: "foreign key",
      name: "purchase_items_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "purchase_items_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds the unique combination and the positive/non-negative checks", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["purchase_id", "product_id", "item_state_id"],
      type: "unique",
      name: "purchase_items_purchase_product_state_unique",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["quantity"],
      type: "check",
      name: "purchase_items_quantity_positive",
      where: { quantity: { GT: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["unit_cost"],
      type: "check",
      name: "purchase_items_unit_cost_non_negative",
      where: { unit_cost: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("purchase_items", {
      fields: ["subtotal"],
      type: "check",
      name: "purchase_items_subtotal_non_negative",
      where: { subtotal: { GTE: 0 } },
    });
  });

  it("indexes the three foreign keys", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addIndex).toHaveBeenCalledWith(
      "purchase_items",
      ["purchase_id"],
      { name: "purchase_items_purchase_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith(
      "purchase_items",
      ["product_id"],
      { name: "purchase_items_product_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith(
      "purchase_items",
      ["item_state_id"],
      { name: "purchase_items_item_state_id_idx" },
    );
  });

  it("drops the table when rolling back", async () => {
    const query = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(query);

    expect(query.dropTable).toHaveBeenCalledWith("purchase_items");
  });
});
