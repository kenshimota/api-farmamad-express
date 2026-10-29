const migration = require("../../migrations/20260910000017-create-purchase-number-sequence");

describe("migration 20260910000017-create-purchase-number-sequence", () => {
  it("creates the ascending purchases sequence", async () => {
    const query = jest.fn();
    const queryInterface = { sequelize: { query } };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface);

    expect(query).toHaveBeenCalledWith(
      'CREATE SEQUENCE IF NOT EXISTS "purchases_number_seq" START WITH 1 INCREMENT BY 1',
    );
  });

  it("drops the sequence when rolling back", async () => {
    const query = jest.fn();
    const queryInterface = { sequelize: { query } };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(query).toHaveBeenCalledWith(
      'DROP SEQUENCE IF EXISTS "purchases_number_seq"',
    );
  });
});
