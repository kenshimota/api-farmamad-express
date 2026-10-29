const migration = require("../../migrations/20260910000013-create-suppliers");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `STRING(${length})`),
    TEXT: "TEXT",
    DATE: "DATE",
    literal: jest.fn((sql) => `LITERAL:${sql}`),
  };
}

/**
 * Builds the query interface double used by the migration.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
  };
}

describe("migration 20260910000013-create-suppliers", () => {
  it("creates the suppliers table with its columns", async () => {
    const queryInterface = queryInterfaceDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith("suppliers", {
      id: {
        type: "INTEGER",
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: "STRING(150)", allowNull: false },
      identification: { type: "STRING(30)", allowNull: false },
      email: { type: "STRING(150)", allowNull: false },
      phone: { type: "STRING(30)", allowNull: false },
      observations: { type: "TEXT", allowNull: true },
      address: { type: "STRING(255)", allowNull: false },
      city_id: { type: "INTEGER", allowNull: false },
      state_id: { type: "INTEGER", allowNull: false },
      createdAt: { type: "DATE", allowNull: false },
      updatedAt: { type: "DATE", allowNull: false },
    });
  });

  it("adds restrictive city and state foreign keys", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("suppliers", {
      fields: ["city_id"],
      type: "foreign key",
      name: "suppliers_city_id_fkey",
      references: { table: "cities", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    expect(queryInterface.addConstraint).toHaveBeenCalledWith("suppliers", {
      fields: ["state_id"],
      type: "foreign key",
      name: "suppliers_state_id_fkey",
      references: { table: "states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds a case-insensitive unique index on identification", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("identification")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "suppliers",
      ['LITERAL:LOWER("identification")'],
      { unique: true, name: "suppliers_identification_lower_unique" },
    );
  });

  it("indexes both foreign keys", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addIndex).toHaveBeenCalledWith("suppliers", [
      "city_id",
    ]);
    expect(queryInterface.addIndex).toHaveBeenCalledWith("suppliers", [
      "state_id",
    ]);
  });

  it("drops the suppliers table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.dropTable).toHaveBeenCalledWith("suppliers");
  });
});
