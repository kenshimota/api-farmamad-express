const migration = require("../../migrations/20260910000025-create-customer-sellers");

/**
 * Builds the Sequelize double used by the migration.
 * @returns {object} Sequelize type double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    DATE: "DATE",
    literal: jest.fn((value) => value),
  };
}

/**
 * Builds a query interface double.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble() {
  return {
    createTable: jest.fn(),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
  };
}

describe("migration 20260910000025-create-customer-sellers", () => {
  it("creates the customer_sellers table with its columns and default", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "customer_sellers",
      {
        id: {
          type: "INTEGER",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        customer_id: { type: "INTEGER", allowNull: false },
        seller_id: { type: "INTEGER", allowNull: false },
        assigned_at: {
          type: "DATE",
          allowNull: false,
          defaultValue: "CURRENT_TIMESTAMP",
        },
        createdAt: { type: "DATE", allowNull: false },
        updatedAt: { type: "DATE", allowNull: false },
      },
    );
    expect(Sequelize.literal).toHaveBeenCalledWith("CURRENT_TIMESTAMP");
  });

  it("adds the CASCADE foreign keys to customers and users", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    const expectations = [
      ["customer_id", "customers"],
      ["seller_id", "users"],
    ];

    for (const [field, table] of expectations) {
      expect(queryInterface.addConstraint).toHaveBeenCalledWith(
        "customer_sellers",
        {
          fields: [field],
          type: "foreign key",
          name: `customer_sellers_${field}_fkey`,
          references: { table, field: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
      );
    }
  });

  it("adds the unique customer_id constraint and the seller index", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "customer_sellers",
      {
        fields: ["customer_id"],
        type: "unique",
        name: "customer_sellers_customer_id_unique",
      },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "customer_sellers",
      ["seller_id"],
      { name: "customer_sellers_seller_id_idx" },
    );
  });

  it("drops the table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith("customer_sellers");
  });
});
