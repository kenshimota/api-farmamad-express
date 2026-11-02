const migration = require("../../migrations/20260910000035-create-order-number-sequence");

describe("migration 20260910000035-create-order-number-sequence", () => {
  it("creates and drops the orders sequence", async () => {
    const queryInterface = {
      sequelize: { query: jest.fn().mockResolvedValue(undefined) },
    };

    await migration.up(queryInterface);
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      'CREATE SEQUENCE IF NOT EXISTS "orders_number_seq" START WITH 1 INCREMENT BY 1',
    );

    await migration.down(queryInterface);
    expect(queryInterface.sequelize.query).toHaveBeenLastCalledWith(
      'DROP SEQUENCE IF EXISTS "orders_number_seq"',
    );
  });
});
