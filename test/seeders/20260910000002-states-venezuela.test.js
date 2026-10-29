const seeder = require("../../seeders/20260910000002-states-venezuela");

const EXPECTED = {
  Amazonas: "VE-Z",
  Anzoátegui: "VE-B",
  Apure: "VE-C",
  Aragua: "VE-D",
  Barinas: "VE-E",
  Bolívar: "VE-F",
  Carabobo: "VE-G",
  Cojedes: "VE-H",
  "Delta Amacuro": "VE-Y",
  "Distrito Capital": "VE-A",
  Falcón: "VE-I",
  Guárico: "VE-J",
  "La Guaira": "VE-X",
  Lara: "VE-K",
  Mérida: "VE-L",
  Miranda: "VE-M",
  Monagas: "VE-N",
  "Nueva Esparta": "VE-O",
  Portuguesa: "VE-P",
  Sucre: "VE-R",
  Táchira: "VE-S",
  Trujillo: "VE-T",
  Yaracuy: "VE-U",
  Zulia: "VE-V",
};

describe("seeder 20260910000002-states-venezuela", () => {
  it("inserts the 24 Venezuelan states with their ISO codes", async () => {
    const queryInterface = { bulkInsert: jest.fn() };

    await seeder.up(queryInterface);

    expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(1);

    const [table, rows, options] = queryInterface.bulkInsert.mock.calls[0];

    expect(table).toBe("states");
    expect(rows).toHaveLength(24);
    expect(rows.map((row) => row.name).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
    expect(rows.map((row) => row.code).sort()).toEqual(
      Object.values(EXPECTED).sort(),
    );
    expect(Object.fromEntries(rows.map((row) => [row.name, row.code]))).toEqual(
      EXPECTED,
    );
    expect(rows.some((row) => row.code === "VE-W")).toBe(false);

    for (const row of rows) {
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
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

  it("deletes only the seeded states when rolling back", async () => {
    const queryInterface = { bulkDelete: jest.fn() };

    await seeder.down(queryInterface);

    expect(queryInterface.bulkDelete).toHaveBeenCalledTimes(1);
    expect(queryInterface.bulkDelete).toHaveBeenCalledWith(
      "states",
      { name: Object.keys(EXPECTED) },
      {},
    );
  });
});
