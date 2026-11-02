const migration = require("../../migrations/20261102000002-add-location-status-to-lots");

/**
 * Builds the Sequelize and query interface doubles used by the migration.
 * @returns {{queryInterface: object, Sequelize: object}} The doubles.
 */
function setup() {
  const queryInterface = {
    addColumn: jest.fn(),
    removeColumn: jest.fn(),
    changeColumn: jest.fn(),
    addConstraint: jest.fn(),
    removeConstraint: jest.fn(),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    sequelize: { query: jest.fn() },
  };
  const Sequelize = {
    INTEGER: "INTEGER",
    STRING: jest.fn((length) => `VARCHAR(${length})`),
    DATE: "DATE",
  };

  return { queryInterface, Sequelize };
}

describe("migration 20261102000002-add-location-status-to-lots", () => {
  it("makes the location optional and adds the lifecycle columns", async () => {
    const { queryInterface, Sequelize } = setup();

    await migration.up(queryInterface, Sequelize);

    for (const field of ["warehouse_id", "shelf_id", "section_id"]) {
      expect(queryInterface.changeColumn).toHaveBeenCalledWith("lots", field, {
        type: "INTEGER",
        allowNull: true,
      });
    }

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "lots",
      "location_status",
      {
        type: "VARCHAR(20)",
        allowNull: false,
        defaultValue: "located",
      },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "lots",
      "location_started_at",
      { type: "DATE", allowNull: true },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "lots",
      "location_started_by",
      { type: "INTEGER", allowNull: true },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "lots",
      "located_at",
      { type: "DATE", allowNull: true },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "lots",
      "located_by",
      { type: "INTEGER", allowNull: true },
    );
  });

  it("backfills located_at and adds the status/location checks", async () => {
    const { queryInterface, Sequelize } = setup();

    await migration.up(queryInterface, Sequelize);

    const sql = queryInterface.sequelize.query.mock.calls
      .map(([statement]) => statement)
      .join(" ");

    expect(sql).toContain('UPDATE "lots" SET "location_status" = \'located\'');
    expect(sql).toContain("lots_location_status_valid");
    expect(sql).toContain("lots_location_block_consistent");
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'in_progress'");
    expect(sql).toContain("'located'");
  });

  it("adds the audit foreign keys and the status index", async () => {
    const { queryInterface, Sequelize } = setup();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "lots",
      expect.objectContaining({
        fields: ["location_started_by"],
        references: { table: "users", field: "id" },
        onDelete: "RESTRICT",
      }),
    );
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      "lots",
      expect.objectContaining({
        fields: ["located_by"],
        references: { table: "users", field: "id" },
        onDelete: "RESTRICT",
      }),
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "lots",
      ["location_status"],
      { name: "lots_location_status_idx" },
    );
  });

  it("removes the lifecycle columns and restores the required location on rollback", async () => {
    const { queryInterface, Sequelize } = setup();

    await migration.down(queryInterface, Sequelize);

    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "lots",
      "location_status",
    );
    for (const field of ["warehouse_id", "shelf_id", "section_id"]) {
      expect(queryInterface.changeColumn).toHaveBeenCalledWith("lots", field, {
        type: "INTEGER",
        allowNull: false,
      });
    }
  });
});
