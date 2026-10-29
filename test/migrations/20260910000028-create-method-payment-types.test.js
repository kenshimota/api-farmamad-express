const migration = require("../../migrations/20260910000028-create-method-payment-types");

/**
 * Builds the Sequelize type double used by the migration.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
    JSONB: "JSONB",
    DATE: "DATE",
    STRING: jest.fn((length) => `STRING(${length})`),
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

describe("migration 20260910000028-create-method-payment-types", () => {
  it("creates the table with the documented columns", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "method_payment_types",
      {
        id: {
          type: "INTEGER",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        code: { type: "STRING(30)", allowNull: false },
        name: { type: "STRING(100)", allowNull: false },
        currency_id: { type: "INTEGER", allowNull: false },
        fields: { type: "JSONB", allowNull: false, defaultValue: [] },
        description: { type: "STRING(255)", allowNull: true },
        is_active: { type: "BOOLEAN", allowNull: false, defaultValue: true },
        createdAt: { type: "DATE", allowNull: false },
        updatedAt: { type: "DATE", allowNull: false },
      },
    );
  });

  it("adds the RESTRICT foreign key to currencies", async () => {
    const queryInterface = queryInterfaceDouble();

    await migration.up(queryInterface, sequelizeDouble());

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "method_payment_types",
      {
        fields: ["currency_id"],
        type: "foreign key",
        name: "method_payment_types_currency_id_fkey",
        references: { table: "currencies", field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
    );
  });

  it("adds the case-insensitive unique index and the currency index", async () => {
    const queryInterface = queryInterfaceDouble();
    const Sequelize = sequelizeDouble();

    await migration.up(queryInterface, Sequelize);

    expect(Sequelize.literal).toHaveBeenCalledWith('LOWER("code")');
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "method_payment_types",
      ['LOWER("code")'],
      {
        unique: true,
        name: "method_payment_types_code_lower_unique",
      },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "method_payment_types",
      ["currency_id"],
      { name: "method_payment_types_currency_id_idx" },
    );
  });

  it("drops the table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith(
      "method_payment_types",
    );
  });
});
