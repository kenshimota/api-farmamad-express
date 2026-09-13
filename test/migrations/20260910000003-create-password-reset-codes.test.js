const migration = require("../../migrations/20260910000003-create-password-reset-codes");

describe("migration 20260910000003-create-password-reset-codes", () => {
  it("creates the password_reset_codes table with its columns and FK", async () => {
    const queryInterface = { createTable: jest.fn() };
    const Sequelize = { INTEGER: "INTEGER", STRING: "STRING", DATE: "DATE" };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledTimes(1);
    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "password_reset_codes",
      {
        id: {
          type: "INTEGER",
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: "INTEGER",
          allowNull: false,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        codeHash: { type: "STRING", allowNull: false },
        expiresAt: { type: "DATE", allowNull: false },
        consumedAt: { type: "DATE", allowNull: true },
        createdAt: { type: "DATE", allowNull: false },
        updatedAt: { type: "DATE", allowNull: false },
      },
    );
  });

  it("drops the table when rolling back", async () => {
    const queryInterface = { dropTable: jest.fn() };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith(
      "password_reset_codes",
    );
  });
});
