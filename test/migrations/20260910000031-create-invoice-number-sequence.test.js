const migration = require("../../migrations/20260910000031-create-invoice-number-sequence");

describe("migration 20260910000031-create-invoice-number-sequence", () => {
  it("creates the ascending invoice sequence", async () => {
    const query = jest.fn();
    const queryInterface = { sequelize: { query } };

    expect(typeof migration.up).toBe("function");

    await migration.up(queryInterface);

    expect(query).toHaveBeenCalledWith(
      'CREATE SEQUENCE IF NOT EXISTS "invoices_number_seq" START WITH 1 INCREMENT BY 1',
    );
  });

  it("drops the sequence when rolling back", async () => {
    const query = jest.fn();
    const queryInterface = { sequelize: { query } };

    expect(typeof migration.down).toBe("function");

    await migration.down(queryInterface);

    expect(query).toHaveBeenCalledWith(
      'DROP SEQUENCE IF EXISTS "invoices_number_seq"',
    );
  });
});
