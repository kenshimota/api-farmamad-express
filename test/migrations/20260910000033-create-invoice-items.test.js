const migration = require("../../migrations/20260910000033-create-invoice-items");

function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `STRING(${length})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATE: "DATE",
    Op: { in: "IN", gt: "GT", gte: "GTE" },
  };
}

function queryInterface() {
  return {
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
  };
}

describe("migration 20260910000033-create-invoice-items", () => {
  it("creates the invoice_items table with the snapshot columns", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.createTable).toHaveBeenCalledWith("invoice_items", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      invoice_id: { type: "INTEGER", allowNull: false },
      order_item_id: { type: "INTEGER", allowNull: true },
      product_id: { type: "INTEGER", allowNull: false },
      item_state_id: { type: "INTEGER", allowNull: false },
      product_name: { type: "STRING(150)", allowNull: false },
      product_reference: { type: "STRING(100)", allowNull: false },
      item_state_name: { type: "STRING(50)", allowNull: false },
      quantity: { type: "INTEGER", allowNull: false },
      unit_price: { type: "DECIMAL(12,2)", allowNull: false },
      subtotal: { type: "DECIMAL(12,2)", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the invoice cascade and the catalog restrictive foreign keys", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["invoice_id"],
      type: "foreign key",
      name: "invoice_items_invoice_id_fkey",
      references: { table: "invoices", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["product_id"],
      type: "foreign key",
      name: "invoice_items_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "invoice_items_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("does not add the order_items foreign key", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    const references = query.addConstraint.mock.calls
      .map(([, constraint]) => constraint.references?.table)
      .filter(Boolean);

    expect(references).not.toContain("order_items");
  });

  it("adds the unique line constraint and the amount checks", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["invoice_id", "order_item_id"],
      type: "unique",
      name: "invoice_items_invoice_order_item_unique",
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["quantity"],
      type: "check",
      name: "invoice_items_quantity_positive",
      where: { quantity: { GT: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["unit_price"],
      type: "check",
      name: "invoice_items_unit_price_non_negative",
      where: { unit_price: { GTE: 0 } },
    });
    expect(query.addConstraint).toHaveBeenCalledWith("invoice_items", {
      fields: ["subtotal"],
      type: "check",
      name: "invoice_items_subtotal_non_negative",
      where: { subtotal: { GTE: 0 } },
    });
  });

  it("indexes the lookup columns and drops the table on rollback", async () => {
    const query = queryInterface();

    await migration.up(query, sequelizeDouble());

    expect(query.addIndex).toHaveBeenCalledWith(
      "invoice_items",
      ["invoice_id"],
      { name: "invoice_items_invoice_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith(
      "invoice_items",
      ["product_id"],
      { name: "invoice_items_product_id_idx" },
    );
    expect(query.addIndex).toHaveBeenCalledWith(
      "invoice_items",
      ["item_state_id"],
      { name: "invoice_items_item_state_id_idx" },
    );

    const down = { dropTable: jest.fn() };
    await migration.down(down);
    expect(down.dropTable).toHaveBeenCalledWith("invoice_items");
  });
});
