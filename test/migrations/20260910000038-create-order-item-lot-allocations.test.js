const migration = require("../../migrations/20260910000038-create-order-item-lot-allocations");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    DATE: "DATE",
    Op: { gt: Symbol.for("gt"), in: Symbol.for("in") },
  };
}

describe("migration 20260910000038-create-order-item-lot-allocations", () => {
  it("creates the allocations table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "order_item_lot_allocations",
      {
        id: {
          type: "INTEGER",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        order_item_id: { type: "INTEGER", allowNull: false },
        lot_id: { type: "INTEGER", allowNull: false },
        quantity: { type: "INTEGER", allowNull: false },
        status: {
          type: "VARCHAR(20)",
          allowNull: false,
          defaultValue: "reserved",
        },
        createdAt: { type: "DATE", allowNull: false },
        updatedAt: { type: "DATE", allowNull: false },
      },
    );
  });

  it("adds the foreign keys, checks, unique pair and indexes", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "order_item_lot_allocations",
      {
        fields: ["order_item_id"],
        type: "foreign key",
        name: "order_item_lot_allocations_order_item_id_fkey",
        references: { table: "order_items", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "order_item_lot_allocations",
      {
        fields: ["lot_id"],
        type: "foreign key",
        name: "order_item_lot_allocations_lot_id_fkey",
        references: { table: "lots", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "order_item_lot_allocations",
      {
        fields: ["order_item_id", "lot_id"],
        type: "unique",
        name: "order_item_lot_allocations_order_item_lot_unique",
      },
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "order_item_lot_allocations",
      {
        fields: ["quantity"],
        type: "check",
        name: "order_item_lot_allocations_quantity_positive",
        where: { quantity: { [Sequelize.Op.gt]: 0 } },
      },
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "order_item_lot_allocations",
      {
        fields: ["status"],
        type: "check",
        name: "order_item_lot_allocations_status_check",
        where: {
          status: {
            [Sequelize.Op.in]: ["reserved", "released", "consumed"],
          },
        },
      },
    );

    for (const column of ["lot_id", "status"]) {
      expect(queryInterface.addIndex).toHaveBeenCalledWith(
        "order_item_lot_allocations",
        [column],
        { name: `order_item_lot_allocations_${column}_idx` },
      );
    }
  });

  it("drops the allocations table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith(
      "order_item_lot_allocations",
    );
  });
});
