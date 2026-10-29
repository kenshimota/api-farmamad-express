const seeder = require("../../seeders/20260910000005-currencies");

const EXPECTED = {
  VES: {
    name: "Bolívar",
    symbol: "Bs",
    rate: "1.000000",
    is_base: true,
  },
  USDT: {
    name: "Tether",
    symbol: "$",
    rate: "1000.290000",
    is_base: false,
  },
  USD_BCV: {
    name: "Dólar BCV",
    symbol: "$",
    rate: "889.890000",
    is_base: false,
  },
};

/**
 * Builds a query interface double backed by an in-memory catalog.
 * @returns {object} Query interface double with access to its state.
 */
function queryInterfaceDouble() {
  const existing = new Map();
  let nextId = 1;
  const queryInterface = {
    bulkInsert: jest.fn(async (table, rows) => {
      if (table === "currencies") {
        for (const row of rows) {
          existing.set(row.code, nextId);
          nextId += 1;
        }
      }
    }),
    rawSelect: jest.fn(async (table, options) => {
      const code = options.where.code;

      return existing.has(code) ? existing.get(code) : null;
    }),
    bulkUpdate: jest.fn(async (table, values, where) => {
      if (
        table === "currencies" &&
        values.is_default_for_transactions === true
      ) {
        for (const [code, id] of existing) {
          if (id === where.id) {
            existing.set(code, id);
          }
        }
      }
    }),
    bulkDelete: jest.fn(async (table, where) => {
      if (table === "currencies") {
        for (const [code, id] of existing) {
          if (id === where.id) {
            existing.delete(code);
          }
        }
      }
    }),
    existing,
  };

  return queryInterface;
}

describe("seeder 20260910000005-currencies", () => {
  it("inserts the three initial currencies", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);

    const rows = queryInterface.bulkInsert.mock.calls
      .filter((call) => call[0] === "currencies")
      .flatMap((call) => call[1]);

    expect(rows.map((row) => row.code).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );

    for (const row of rows) {
      expect(row).toEqual(
        expect.objectContaining({
          ...EXPECTED[row.code],
          is_active: true,
        }),
      );
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("marks USD_BCV as the default transaction currency", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);

    const rows = queryInterface.bulkInsert.mock.calls
      .filter((call) => call[0] === "currencies")
      .flatMap((call) => call[1]);
    const bcv = rows.find((row) => row.code === "USD_BCV");

    expect(bcv).toEqual(
      expect.objectContaining({
        is_active: true,
        is_default_for_transactions: true,
      }),
    );
  });

  it("inserts one seed history row per inserted currency", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);

    const historyCalls = queryInterface.bulkInsert.mock.calls.filter(
      (call) => call[0] === "currency_rate_history",
    );

    expect(historyCalls).toHaveLength(3);

    for (const call of historyCalls) {
      const [row] = call[1];

      expect(row).toEqual({
        currency_id: expect.any(Number),
        previous_rate: null,
        new_rate: expect.stringMatching(/^\d+\.\d{6}$/),
        changed_by: null,
        changed_at: expect.any(Date),
        reason: "seed",
      });
    }
  });

  it("never overwrites an existing currency and is idempotent", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);
    await seeder.up(queryInterface);

    const currencyInserts = queryInterface.bulkInsert.mock.calls.filter(
      (call) => call[0] === "currencies",
    );
    const historyInserts = queryInterface.bulkInsert.mock.calls.filter(
      (call) => call[0] === "currency_rate_history",
    );

    expect(currencyInserts).toHaveLength(3);
    expect(historyInserts).toHaveLength(3);
  });

  it("keeps an existing rate untouched", async () => {
    const queryInterface = queryInterfaceDouble();
    queryInterface.existing.set("USDT", 42);

    await seeder.up(queryInterface);

    const codes = queryInterface.bulkInsert.mock.calls
      .filter((call) => call[0] === "currencies")
      .flatMap((call) => call[1])
      .map((row) => row.code);

    expect(codes).not.toContain("USDT");
    expect(codes.sort()).toEqual(["USD_BCV", "VES"]);
  });

  it("removes the seeded currencies and their history when rolling back", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);
    await seeder.down(queryInterface);

    const deletedCurrencies = queryInterface.bulkDelete.mock.calls
      .filter((call) => call[0] === "currencies")
      .map((call) => call[1]);
    const deletedHistory = queryInterface.bulkDelete.mock.calls
      .filter((call) => call[0] === "currency_rate_history")
      .map((call) => call[1]);

    expect(deletedCurrencies).toHaveLength(3);
    expect(deletedHistory).toHaveLength(3);
    expect(queryInterface.existing.size).toBe(0);
  });

  it("skips missing currencies when rolling back", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.down(queryInterface);

    expect(queryInterface.bulkDelete).not.toHaveBeenCalled();
  });
});
