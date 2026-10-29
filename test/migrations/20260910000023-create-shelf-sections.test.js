const migration = require("../../migrations/20260910000023-create-shelf-sections");

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

describe("migration 20260910000023-create-shelf-sections", () => {
  it("creates the shelf_sections table with its columns", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledWith("shelf_sections", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      shelf_id: { type: "INTEGER", allowNull: false },
      code: { type: "VARCHAR(50)", allowNull: false },
      name: { type: "VARCHAR(100)", allowNull: true },
      description: { type: "VARCHAR(255)", allowNull: true },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds the shelf foreign key with CASCADE", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "shelf_sections",
      {
        fields: ["shelf_id"],
        type: "foreign key",
        name: "shelf_sections_shelf_id_fkey",
        references: { table: "shelves", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
    );
  });

  it("adds a case-insensitive unique code index per shelf", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("code")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "shelf_sections",
      ["shelf_id", 'LOWER("code")'],
      {
        unique: true,
        name: "shelf_sections_shelf_code_lower_unique",
      },
    );
  });

  it("adds the shelf index", async () => {
    const queryInterface = {
      createTable: jest.fn(),
      addConstraint: jest.fn(),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "shelf_sections",
      ["shelf_id"],
      { name: "shelf_sections_shelf_id_idx" },
    );
  });

  it("drops the shelf_sections table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("shelf_sections");
  });
});
