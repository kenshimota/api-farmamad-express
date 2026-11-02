const seeder = require("../../seeders/20260910000008-demo-catalog");

describe("demo catalog seeder entrypoint", () => {
  it("only runs when sequelize-cli is invoked with --seed", () => {
    expect(seeder.shouldRunFromCli(["node", "sequelize", "db:seed:all"])).toBe(
      false,
    );
    expect(
      seeder.shouldRunFromCli([
        "node",
        "sequelize",
        "db:seed",
        "--seed",
        "seeders/20260910000008-demo-catalog.js",
      ]),
    ).toBe(true);
  });

  it("does not touch the database when db:seed runs it implicitly", async () => {
    const queryInterface = { sequelize: { transaction: jest.fn() } };
    const original = process.argv;
    process.argv = ["node", "sequelize", "db:seed:all"];

    try {
      await expect(seeder.up(queryInterface)).resolves.toBeUndefined();
      expect(queryInterface.sequelize.transaction).not.toHaveBeenCalled();
    } finally {
      process.argv = original;
    }
  });
});
