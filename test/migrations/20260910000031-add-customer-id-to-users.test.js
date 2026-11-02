const migration = require("../../migrations/20260910000031-add-customer-id-to-users");

/**
 * Builds the Sequelize type double used by the migration.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return { INTEGER: "INTEGER" };
}

/**
 * Builds a query interface double.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    addColumn: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    removeConstraint: jest.fn(),
    removeColumn: jest.fn(),
  };
}

describe("migration 20260910000031-add-customer-id-to-users", () => {
  it("adds the nullable customer_id column to users", async () => {
    const queryInterface = queryInterfaceDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "users",
      "customer_id",
      {
        type: "INTEGER",
        allowNull: true,
      },
    );
  });

  it("adds the RESTRICT foreign key to customers", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith("users", {
      fields: ["customer_id"],
      type: "foreign key",
      name: "users_customer_id_fkey",
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  });

  it("adds the unique and lookup indexes on customer_id", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "users",
      ["customer_id"],
      { unique: true, name: "users_customer_id_unique" },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "users",
      ["customer_id"],
      { name: "users_customer_id_idx" },
    );
  });

  it("removes the indexes, constraint and column when rolling back", async () => {
    const queryInterface = queryInterfaceDouble();

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.removeIndex).toHaveBeenCalledWith(
      "users",
      "users_customer_id_idx",
    );
    expect(queryInterface.removeIndex).toHaveBeenCalledWith(
      "users",
      "users_customer_id_unique",
    );
    expect(queryInterface.removeConstraint).toHaveBeenCalledWith(
      "users",
      "users_customer_id_fkey",
    );
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "users",
      "customer_id",
    );
  });
});
