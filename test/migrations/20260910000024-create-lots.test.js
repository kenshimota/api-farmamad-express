const migration = require("../../migrations/20260910000024-create-lots");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    INTEGER: "INTEGER",
    DATE: "DATE",
    DATEONLY: "DATEONLY",
    col: jest.fn((value) => `COL(${value})`),
    literal: jest.fn((value) => value),
    Op: { gte: Symbol.for("gte"), lte: Symbol.for("lte") },
  };
}

describe("migration 20260910000024-create-lots", () => {
  it("creates the lots table with its columns and defaults", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledWith("lots", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      number: { type: "VARCHAR(100)", allowNull: false },
      product_id: { type: "INTEGER", allowNull: false },
      expiration_date: { type: "DATEONLY", allowNull: false },
      item_state_id: { type: "INTEGER", allowNull: false },
      stock: { type: "INTEGER", allowNull: false, defaultValue: 0 },
      reserved: { type: "INTEGER", allowNull: false, defaultValue: 0 },
      warehouse_id: { type: "INTEGER", allowNull: false },
      shelf_id: { type: "INTEGER", allowNull: false },
      section_id: { type: "INTEGER", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the five RESTRICT foreign keys", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    const expectations = [
      ["product_id", "products"],
      ["item_state_id", "item_states"],
      ["warehouse_id", "warehouses"],
      ["shelf_id", "shelves"],
      ["section_id", "shelf_sections"],
    ];

    for (const [field, table] of expectations) {
      expect(queryInterface.addConstraint).toHaveBeenCalledWith("lots", {
        fields: [field],
        type: "foreign key",
        name: `lots_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }
  });

  it("adds the non-negative and reserved-within-stock checks", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("lots", {
      fields: ["stock"],
      type: "check",
      name: "lots_stock_non_negative",
      where: { stock: { [Sequelize.Op.gte]: 0 } },
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("lots", {
      fields: ["reserved"],
      type: "check",
      name: "lots_reserved_non_negative",
      where: { reserved: { [Sequelize.Op.gte]: 0 } },
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("lots", {
      fields: ["reserved", "stock"],
      type: "check",
      name: "lots_reserved_within_stock",
      where: { reserved: { [Sequelize.Op.lte]: "COL(stock)" } },
    });
  });

  it("adds a case-insensitive unique number index per product", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("number")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "lots",
      ["product_id", 'LOWER("number")'],
      {
        unique: true,
        name: "lots_product_id_number_lower_unique",
      },
    );
  });

  it("adds the documented lookup indexes", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    for (const column of [
      "product_id",
      "item_state_id",
      "warehouse_id",
      "shelf_id",
      "section_id",
      "expiration_date",
    ]) {
      expect(queryInterface.addIndex).toHaveBeenCalledWith("lots", [column], {
        name: `lots_${column}_idx`,
      });
    }
  });

  it("drops the lots table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("lots");
  });
});
