const { ForeignKeyConstraintError } = require("sequelize");
const seeder = require("../../seeders/20260910000004-item-states");

const EXPECTED = {
  sellable: { label: "Vendible", is_sellable: true },
  damaged: { label: "Maltratado", is_sellable: false },
  expired: { label: "Vencido", is_sellable: false },
  quarantine: { label: "Cuarentena", is_sellable: false },
  reserved: { label: "Reservado", is_sellable: false },
};

describe("seeder 20260910000004-item-states", () => {
  it("inserts the five initial item states", async () => {
    const queryInterface = { bulkInsert: jest.fn() };

    await seeder.up(queryInterface);

    expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(1);

    const [table, rows, options] = queryInterface.bulkInsert.mock.calls[0];

    expect(table).toBe("item_states");
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.name).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
    expect(
      Object.fromEntries(
        rows.map((row) => [
          row.name,
          { label: row.label, is_sellable: row.is_sellable },
        ]),
      ),
    ).toEqual(EXPECTED);

    for (const row of rows) {
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
      expect(row.description).toBeNull();
    }

    expect(options).toEqual({ ignoreDuplicates: true });
  });

  it("is idempotent because it relies on ignoreDuplicates", async () => {
    const queryInterface = { bulkInsert: jest.fn() };

    await seeder.up(queryInterface);
    await seeder.up(queryInterface);

    expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(2);
    expect(queryInterface.bulkInsert.mock.calls[0][2]).toEqual({
      ignoreDuplicates: true,
    });
    expect(queryInterface.bulkInsert.mock.calls[1][2]).toEqual({
      ignoreDuplicates: true,
    });
  });

  it("deletes only the seeded item states when rolling back", async () => {
    const queryInterface = { bulkDelete: jest.fn() };

    await seeder.down(queryInterface);

    expect(queryInterface.bulkDelete).toHaveBeenCalledTimes(5);
    expect(queryInterface.bulkDelete.mock.calls.map((call) => call[1])).toEqual(
      Object.keys(EXPECTED).map((name) => ({ name })),
    );

    for (const call of queryInterface.bulkDelete.mock.calls) {
      expect(call[0]).toBe("item_states");
      expect(call[2]).toEqual({});
    }
  });

  it("skips the seeded item states that are still referenced", async () => {
    const referenced = new ForeignKeyConstraintError({
      message: "foreign key",
    });
    const queryInterface = {
      bulkDelete: jest.fn((table, where) =>
        where.name === "damaged"
          ? Promise.reject(referenced)
          : Promise.resolve(),
      ),
    };

    await expect(seeder.down(queryInterface)).resolves.toBeUndefined();
    expect(queryInterface.bulkDelete).toHaveBeenCalledTimes(5);
  });

  it("rethrows unexpected errors when rolling back", async () => {
    const error = new Error("database exploded");
    const queryInterface = { bulkDelete: jest.fn().mockRejectedValue(error) };

    await expect(seeder.down(queryInterface)).rejects.toThrow(error);
    expect(queryInterface.bulkDelete).toHaveBeenCalledTimes(1);
  });
});
