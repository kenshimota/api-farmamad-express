const { Op } = require("sequelize");
const seeder = require("../../seeders/20260910000003-cities-venezuela");

const CAPITALS = {
  Amazonas: "Puerto Ayacucho",
  Anzoátegui: "Barcelona",
  Apure: "San Fernando de Apure",
  Aragua: "Maracay",
  Barinas: "Barinas",
  Bolívar: "Ciudad Bolívar",
  Carabobo: "Valencia",
  Cojedes: "San Carlos",
  "Delta Amacuro": "Tucupita",
  "Distrito Capital": "Caracas",
  Falcón: "Coro",
  Guárico: "San Juan de los Morros",
  "La Guaira": "La Guaira",
  Lara: "Barquisimeto",
  Mérida: "Mérida",
  Miranda: "Los Teques",
  Monagas: "Maturín",
  "Nueva Esparta": "La Asunción",
  Portuguesa: "Guanare",
  Sucre: "Cumaná",
  Táchira: "San Cristóbal",
  Trujillo: "Trujillo",
  Yaracuy: "San Felipe",
  Zulia: "Maracaibo",
};

const ADDITIONAL = {
  "Puerto La Cruz": "Anzoátegui",
  "El Tigre": "Anzoátegui",
  "Ciudad Guayana": "Bolívar",
  "Puerto Cabello": "Carabobo",
  "Punto Fijo": "Falcón",
  Cabimas: "Zulia",
  Acarigua: "Portuguesa",
  Araure: "Portuguesa",
  Valera: "Trujillo",
  Guarenas: "Miranda",
  Guatire: "Miranda",
  Petare: "Miranda",
  Baruta: "Miranda",
  "El Vigía": "Mérida",
};

const STATE_IDS = Object.fromEntries(
  Object.keys(CAPITALS).map((name, index) => [name, index + 1]),
);

/**
 * Builds a query interface double that resolves the seeded state ids.
 * @param {Record<string, number>} ids - State name to id map.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble(ids = STATE_IDS) {
  return {
    rawSelect: jest.fn(async (table, { where }) => {
      expect(table).toBe("states");

      return ids[where.name] ?? null;
    }),
    bulkInsert: jest.fn(),
    bulkDelete: jest.fn(),
  };
}

describe("seeder 20260910000003-cities-venezuela", () => {
  it("inserts at least 38 cities with the correct state", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);

    expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(1);

    const [table, rows, options] = queryInterface.bulkInsert.mock.calls[0];

    expect(table).toBe("cities");
    expect(rows.length).toBeGreaterThanOrEqual(38);
    expect(options).toEqual({ ignoreDuplicates: true });

    const stored = Object.fromEntries(
      rows.map((row) => [row.name, row.state_id]),
    );

    for (const [state, city] of Object.entries(CAPITALS)) {
      expect(stored[city]).toBe(STATE_IDS[state]);
    }

    for (const [city, state] of Object.entries(ADDITIONAL)) {
      expect(stored[city]).toBe(STATE_IDS[state]);
    }

    for (const row of rows) {
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("fails with a clear message when a state is missing", async () => {
    const ids = { ...STATE_IDS };
    delete ids.Aragua;
    const queryInterface = queryInterfaceDouble(ids);

    await expect(seeder.up(queryInterface)).rejects.toThrow(
      'State "Aragua" is not seeded',
    );
    expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
  });

  it("deletes only the seeded (name, state) pairs when rolling back", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.down(queryInterface);

    expect(queryInterface.bulkDelete).toHaveBeenCalledTimes(1);

    const [table, where, options] = queryInterface.bulkDelete.mock.calls[0];

    expect(table).toBe("cities");
    expect(options).toEqual({});
    expect(where[Op.or]).toHaveLength(38);
    expect(where[Op.or]).toEqual(
      expect.arrayContaining([
        { name: "Maracay", state_id: STATE_IDS.Aragua },
        { name: "Puerto La Cruz", state_id: STATE_IDS["Anzoátegui"] },
        { name: "El Vigía", state_id: STATE_IDS["Mérida"] },
      ]),
    );
  });

  it("skips missing states when rolling back instead of failing", async () => {
    const ids = { ...STATE_IDS };
    delete ids.Aragua;
    const queryInterface = queryInterfaceDouble(ids);

    await seeder.down(queryInterface);

    const [, where] = queryInterface.bulkDelete.mock.calls[0];

    expect(where[Op.or]).toHaveLength(37);
    expect(where[Op.or].some((condition) => condition.name === "Maracay")).toBe(
      false,
    );
  });
});
