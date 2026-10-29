const seeder = require("../../seeders/20260910000006-method-payment-types");

const CURRENCIES = {
  USD_BCV: 3,
  USDT: 2,
  VES: 1,
};
const EXPECTED_FIELDS = {
  PAYPAL: [
    {
      key: "email",
      label: "Correo de PayPal",
      type: "email",
      required: true,
    },
  ],
  BINANCE: [
    {
      key: "wallet_address",
      label: "Dirección de wallet",
      type: "text",
      required: true,
      max_length: 200,
    },
    {
      key: "network",
      label: "Red",
      type: "text",
      required: true,
      max_length: 30,
    },
  ],
  BANK: [
    {
      key: "bank_name",
      label: "Banco",
      type: "text",
      required: true,
      max_length: 100,
    },
    {
      key: "account_number",
      label: "Número de cuenta",
      type: "text",
      required: true,
      max_length: 30,
    },
    {
      key: "account_type",
      label: "Tipo de cuenta",
      type: "text",
      required: true,
      max_length: 30,
    },
    {
      key: "holder_name",
      label: "Titular",
      type: "text",
      required: true,
      max_length: 100,
    },
    {
      key: "holder_id",
      label: "Cédula o RIF del titular",
      type: "text",
      required: true,
      max_length: 20,
    },
  ],
  PAGO_MOVIL: [
    {
      key: "bank_name",
      label: "Banco",
      type: "text",
      required: true,
      max_length: 100,
    },
    { key: "phone", label: "Teléfono", type: "phone", required: true },
    {
      key: "holder_id",
      label: "Cédula o RIF",
      type: "text",
      required: true,
      max_length: 20,
    },
  ],
};

/**
 * Builds a query interface double backed by in-memory tables.
 * @param {object} [options] - Initial state options.
 * @param {object} [options.currencies] - Currency code to id map.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble({ currencies = CURRENCIES } = {}) {
  const types = new Map();
  const currencyMap = new Map(Object.entries(currencies));
  let nextId = 1;
  const queryInterface = {
    rawSelect: jest.fn(async (table, options) => {
      const code = options.where.code;

      if (table === "currencies") {
        return currencyMap.has(code) ? currencyMap.get(code) : null;
      }

      return types.has(code) ? types.get(code) : null;
    }),
    bulkInsert: jest.fn(async (table, rows) => {
      if (table === "method_payment_types") {
        for (const row of rows) {
          types.set(row.code, nextId);
          nextId += 1;
        }
      }
    }),
    bulkDelete: jest.fn(async (table, where) => {
      if (table === "method_payment_types") {
        for (const code of where.code) {
          types.delete(code);
        }
      }
    }),
    types,
  };

  return queryInterface;
}

/**
 * Reads the inserted type rows from the double.
 * @param {object} queryInterface - Query interface double.
 * @returns {object[]} Inserted rows.
 */
function insertedRows(queryInterface) {
  return queryInterface.bulkInsert.mock.calls
    .filter((call) => call[0] === "method_payment_types")
    .flatMap((call) => call[1]);
}

describe("seeder 20260910000006-method-payment-types", () => {
  it("inserts the four initial types with their fields and currencies", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);

    const rows = insertedRows(queryInterface);

    expect(rows.map((row) => row.code).sort()).toEqual(
      Object.keys(EXPECTED_FIELDS).sort(),
    );

    const byCode = Object.fromEntries(rows.map((row) => [row.code, row]));
    expect(byCode.PAYPAL).toEqual(
      expect.objectContaining({
        name: "PayPal",
        currency_id: CURRENCIES.USD_BCV,
        fields: JSON.stringify(EXPECTED_FIELDS.PAYPAL),
        is_active: true,
      }),
    );
    expect(byCode.BINANCE).toEqual(
      expect.objectContaining({
        name: "Binance",
        currency_id: CURRENCIES.USDT,
        fields: JSON.stringify(EXPECTED_FIELDS.BINANCE),
      }),
    );
    expect(byCode.BANK).toEqual(
      expect.objectContaining({
        name: "Banco Nacional",
        currency_id: CURRENCIES.VES,
        fields: JSON.stringify(EXPECTED_FIELDS.BANK),
      }),
    );
    expect(byCode.PAGO_MOVIL).toEqual(
      expect.objectContaining({
        name: "Pago Móvil",
        currency_id: CURRENCIES.VES,
        fields: JSON.stringify(EXPECTED_FIELDS.PAGO_MOVIL),
      }),
    );

    for (const row of rows) {
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
      expect(JSON.parse(row.fields)).toEqual(EXPECTED_FIELDS[row.code]);
    }
  });

  it("is idempotent and never overwrites existing types", async () => {
    const queryInterface = queryInterfaceDouble();
    queryInterface.types.set("PAYPAL", 42);

    await seeder.up(queryInterface);
    await seeder.up(queryInterface);

    const rows = insertedRows(queryInterface);

    expect(rows.map((row) => row.code).sort()).toEqual([
      "BANK",
      "BINANCE",
      "PAGO_MOVIL",
    ]);
    expect(queryInterface.types.get("PAYPAL")).toBe(42);
  });

  it("fails with a clear message when a required currency is missing", async () => {
    const queryInterface = queryInterfaceDouble({
      currencies: { USD_BCV: 3, VES: 1 },
    });

    await expect(seeder.up(queryInterface)).rejects.toThrow(/USDT.*HU-22/);
    expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
  });

  it("removes the seeded types when rolling back", async () => {
    const queryInterface = queryInterfaceDouble();

    await seeder.up(queryInterface);
    await seeder.down(queryInterface);

    expect(queryInterface.bulkDelete).toHaveBeenCalledWith(
      "method_payment_types",
      {
        code: expect.arrayContaining([
          "PAYPAL",
          "BINANCE",
          "BANK",
          "PAGO_MOVIL",
        ]),
      },
    );
    expect(queryInterface.types.size).toBe(0);
  });
});
