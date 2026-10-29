const seeder = require("../../seeders/20260910000001-roles");

const ROLES = [
  "admin",
  "customer",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
];

describe("seeder 20260910000001-roles", () => {
  it("inserts only the six catalog roles with ignoreDuplicates", async () => {
    const queryInterface = { bulkInsert: jest.fn() };

    await seeder.up(queryInterface);

    expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(1);

    const [table, rows, options] = queryInterface.bulkInsert.mock.calls[0];

    expect(table).toBe("roles");
    expect(rows.map((row) => row.name)).toEqual(ROLES);
    expect(new Set(rows.map((row) => row.name)).size).toBe(6);

    for (const row of rows) {
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }

    expect(options).toEqual({ ignoreDuplicates: true });
  });

  it("deletes only the roles it manages when rolling back", async () => {
    const queryInterface = { bulkDelete: jest.fn() };

    await seeder.down(queryInterface);

    expect(queryInterface.bulkDelete).toHaveBeenCalledTimes(1);
    expect(queryInterface.bulkDelete).toHaveBeenCalledWith(
      "roles",
      { name: ROLES },
      {},
    );
  });
});
