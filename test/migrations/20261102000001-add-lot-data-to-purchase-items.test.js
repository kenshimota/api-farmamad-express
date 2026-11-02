const migration = require("../../migrations/20261102000001-add-lot-data-to-purchase-items");

/**
 * Builds the Sequelize and query interface doubles used by the migration.
 * @returns {{queryInterface: object, Sequelize: object}} The doubles.
 */
function setup() {
  const queryInterface = {
    addColumn: jest.fn(),
    removeColumn: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    sequelize: { query: jest.fn() },
  };
  const Sequelize = {
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    INTEGER: "INTEGER",
    DATEONLY: "DATEONLY",
  };

  return { queryInterface, Sequelize };
}

describe("migration 20261102000001-add-lot-data-to-purchase-items", () => {
  it("adds the three nullable lot columns", async () => {
    const { queryInterface, Sequelize } = setup();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "purchase_items",
      "lot_number",
      { type: "VARCHAR(100)", allowNull: true },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "purchase_items",
      "expiration_date",
      { type: "DATEONLY", allowNull: true },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "purchase_items",
      "received_lot_id",
      { type: "INTEGER", allowNull: true },
    );
  });

  it("replaces the old unique combination and adds checks and indexes", async () => {
    const { queryInterface, Sequelize } = setup();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.removeConstraint).toHaveBeenCalledWith(
      "purchase_items",
      "purchase_items_purchase_product_state_unique",
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "purchase_items",
      expect.objectContaining({
        fields: ["received_lot_id"],
        type: "foreign key",
        references: { table: "lots", field: "id" },
        onDelete: "RESTRICT",
      }),
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "purchase_items",
      ["received_lot_id"],
      { name: "purchase_items_received_lot_id_idx" },
    );
    const sql = queryInterface.sequelize.query.mock.calls
      .map(([statement]) => statement)
      .join(" ");

    expect(sql).toContain("purchase_items_lot_pair_complete");
    expect(sql).toContain("purchase_items_received_lot_requires_lot_number");
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "purchase_items_purchase_product_lot_unique"',
    );
    expect(sql).toContain('LOWER("lot_number")');
    expect(sql).toContain('WHERE "lot_number" IS NOT NULL');
  });

  it("restores the old constraint when rolling back", async () => {
    const { queryInterface } = setup();

    await migration.down(queryInterface);

    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "purchase_items",
      "received_lot_id",
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "purchase_items",
      {
        fields: ["purchase_id", "product_id", "item_state_id"],
        type: "unique",
        name: "purchase_items_purchase_product_state_unique",
      },
    );
  });
});
