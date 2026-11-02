const migration = require("../../migrations/20260910000037-create-order-items");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATE: "DATE",
    Op: { gt: Symbol.for("gt"), gte: Symbol.for("gte") },
  };
}

describe("migration 20260910000037-create-order-items", () => {
  it("creates the order_items table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledWith("order_items", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      order_id: { type: "INTEGER", allowNull: false },
      product_id: { type: "INTEGER", allowNull: false },
      item_state_id: { type: "INTEGER", allowNull: false },
      quantity: { type: "INTEGER", allowNull: false },
      unit_price: { type: "DECIMAL(12,2)", allowNull: false },
      subtotal: { type: "DECIMAL(12,2)", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the foreign keys, checks, unique pair and indexes", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["order_id"],
      type: "foreign key",
      name: "order_items_order_id_fkey",
      references: { table: "orders", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["product_id"],
      type: "foreign key",
      name: "order_items_product_id_fkey",
      references: { table: "products", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["item_state_id"],
      type: "foreign key",
      name: "order_items_item_state_id_fkey",
      references: { table: "item_states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["order_id", "product_id", "item_state_id"],
      type: "unique",
      name: "order_items_order_product_state_unique",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["quantity"],
      type: "check",
      name: "order_items_quantity_positive",
      where: { quantity: { [Sequelize.Op.gt]: 0 } },
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["unit_price"],
      type: "check",
      name: "order_items_unit_price_non_negative",
      where: { unit_price: { [Sequelize.Op.gte]: 0 } },
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("order_items", {
      fields: ["subtotal"],
      type: "check",
      name: "order_items_subtotal_non_negative",
      where: { subtotal: { [Sequelize.Op.gte]: 0 } },
    });

    for (const column of ["order_id", "product_id", "item_state_id"]) {
      expect(queryInterface.addIndex).toHaveBeenCalledWith(
        "order_items",
        [column],
        { name: `order_items_${column}_idx` },
      );
    }
  });

  it("drops the order_items table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("order_items");
  });
});
