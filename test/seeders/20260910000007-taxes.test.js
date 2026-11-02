const { Op } = require("sequelize");
const seeder = require("../../seeders/20260910000007-taxes");

const BASE_TAXES = Object.freeze([
  {
    code: "IVA",
    name: "Impuesto al Valor Agregado",
    rate: "16.00",
    description: "IVA general de Venezuela",
  },
  {
    code: "SIN_IVA",
    name: "Sin IVA",
    rate: "0.00",
    description: "Producto exento o no gravado",
  },
]);

/**
 * Reads the requested code from a `where` clause produced by the seeder.
 * @param {object} where - Sequelize where clause.
 * @returns {string} The code to look up.
 */
function requestedCode(where) {
  const value = where.code;

  return typeof value === "object" ? value[Op.iLike] : value;
}

/**
 * Builds a query interface double backed by in-memory tax and product tables.
 * @param {object} [options] - Initial state options.
 * @param {object} [options.taxes] - Map of lowercase code to stored row.
 * @param {number[]} [options.referencedIds] - Tax ids used by products.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble({ taxes = {}, referencedIds = [] } = {}) {
  const state = new Map(Object.entries(taxes));
  const references = new Set(referencedIds);
  let nextId = Math.max(
    0,
    ...references,
    ...[...state.values()].map((row) => row.id),
  );

  const queryInterface = {
    rawSelect: jest.fn(async (table, options) => {
      if (table === "products") {
        const taxId = options.where.tax_id;

        return references.has(taxId) ? 1 : null;
      }

      const row = state.get(requestedCode(options.where).toLowerCase());

      return row ? row.id : null;
    }),
    bulkInsert: jest.fn(async (table, rows) => {
      for (const row of rows) {
        nextId += 1;
        state.set(row.code.toLowerCase(), { ...row, id: nextId });
      }
    }),
    bulkDelete: jest.fn(async (table, where) => {
      for (const id of where.id) {
        for (const [code, row] of state) {
          if (row.id === id) {
            state.delete(code);
          }
        }
      }
    }),
    state,
  };

  return queryInterface;
}

describe("seeder 20260910000007-taxes", () => {
  it("inserts IVA 16 % and SIN_IVA 0 % as active taxes", async () => {
    const query = queryInterfaceDouble();

    await seeder.up(query);

    const rows = query.bulkInsert.mock.calls.flatMap((call) => call[1]);

    expect(rows.map((row) => row.code).sort()).toEqual(["IVA", "SIN_IVA"]);

    for (const base of BASE_TAXES) {
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...base,
            is_active: true,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        ]),
      );
    }
  });

  it("is idempotent and matches existing codes ignoring case", async () => {
    const query = queryInterfaceDouble({
      taxes: {
        iva: {
          id: 42,
          ...BASE_TAXES[0],
          code: "IVA",
          is_active: false,
        },
      },
    });

    await seeder.up(query);
    await seeder.up(query);

    const inserted = query.bulkInsert.mock.calls.flatMap((call) => call[1]);

    expect(inserted.map((row) => row.code)).toEqual(["SIN_IVA"]);
    expect(query.state.get("iva")).toMatchObject({
      id: 42,
      code: "IVA",
      is_active: false,
    });
    expect(query.bulkUpdate).toBeUndefined();
  });

  it("does not overwrite an existing base tax with the same code", async () => {
    const query = queryInterfaceDouble({
      taxes: {
        sin_iva: {
          id: 7,
          ...BASE_TAXES[1],
          name: "Tasa ajustada",
          rate: "5.00",
          is_active: false,
        },
      },
    });

    await seeder.up(query);

    expect(query.state.get("sin_iva")).toMatchObject({
      id: 7,
      name: "Tasa ajustada",
      rate: "5.00",
      is_active: false,
    });
    expect(query.bulkInsert).toHaveBeenCalledTimes(1);
  });

  it("deletes only the base taxes that are not in use on rollback", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const query = queryInterfaceDouble({
      taxes: {
        iva: { id: 1, ...BASE_TAXES[0] },
        sin_iva: { id: 2, ...BASE_TAXES[1] },
        igtf: { id: 3, code: "IGTF", name: "IGTF", rate: "3.00" },
      },
      referencedIds: [1],
    });

    await seeder.down(query);

    expect(query.bulkDelete).toHaveBeenCalledWith("taxes", { id: [2] });
    expect(query.state.has("iva")).toBe(true);
    expect(query.state.has("sin_iva")).toBe(false);
    expect(query.state.has("igtf")).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("IVA"));

    warn.mockRestore();
  });

  it("skips missing base taxes during rollback", async () => {
    const query = queryInterfaceDouble();

    await seeder.down(query);

    expect(query.bulkDelete).not.toHaveBeenCalled();
  });
});
