const migration = require("../../migrations/20260910000022-create-shelves");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    INTEGER: "INTEGER",
    DATE: "DATE",
    literal: jest.fn((value) => value),
  };
}

describe("migration 20260910000022-create-shelves", () => {
  it("creates the shelves table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledWith("shelves", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      warehouse_id: { type: "INTEGER", allowNull: false },
      code: { type: "VARCHAR(50)", allowNull: false },
      name: { type: "VARCHAR(100)", allowNull: true },
      description: { type: "VARCHAR(255)", allowNull: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the warehouse foreign key with RESTRICT", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("shelves", {
      fields: ["warehouse_id"],
      type: "foreign key",
      name: "shelves_warehouse_id_fkey",
      references: { table: "warehouses", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds a case-insensitive unique code index per warehouse", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("code")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "shelves",
      ["warehouse_id", 'LOWER("code")'],
      {
        unique: true,
        name: "shelves_warehouse_code_lower_unique",
      },
    );
  });

  it("adds the warehouse index", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "shelves",
      ["warehouse_id"],
      { name: "shelves_warehouse_id_idx" },
    );
  });

  it("drops the shelves table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("shelves");
  });
});
