const {
  toPublicChangedBy,
  toPublicCurrency,
  toPublicHistoryEntry,
  toRateNumber,
} = require("./serializer");

const CURRENCY = {
  id: 2,
  code: "USDT",
  name: "Tether",
  symbol: "$",
  rate: "1000.290000",
  is_base: false,
  is_active: true,
  createdAt: new Date("2026-10-29T12:00:00.000Z"),
  updatedAt: new Date("2026-10-29T12:00:00.000Z"),
};

const HISTORY = {
  id: 5,
  currency_id: 2,
  previous_rate: "1000.290000",
  new_rate: "1005.750000",
  changed_by: {
    id: 1,
    username: "admin",
    email: "admin@farmamad.com",
  },
  changed_at: new Date("2026-10-29T15:30:00.000Z"),
  reason: "Actualización diaria BCV",
};

describe("toRateNumber", () => {
  it.each([
    ["1000.290000", 1000.29],
    ["1.000000", 1],
    ["0.000001", 0.000001],
    [1, 1],
    [0, 0],
  ])("serializes %p as the number %p", (value, expected) => {
    expect(toRateNumber(value)).toBe(expected);
  });

  it.each([null, undefined, "", "abc", NaN, Infinity])(
    "returns null for %p",
    (value) => {
      expect(toRateNumber(value)).toBeNull();
    },
  );

  it("rounds to six decimals", () => {
    expect(toRateNumber("1.1234567")).toBe(1.123457);
  });
});

describe("toPublicCurrency", () => {
  it("exposes only the documented fields as numbers and booleans", () => {
    expect(toPublicCurrency(CURRENCY)).toEqual({
      id: 2,
      code: "USDT",
      name: "Tether",
      symbol: "$",
      rate: 1000.29,
      is_base: false,
      is_active: true,
      is_default_for_transactions: false,
    });
    expect(Object.keys(toPublicCurrency(CURRENCY))).toEqual([
      "id",
      "code",
      "name",
      "symbol",
      "rate",
      "is_base",
      "is_active",
      "is_default_for_transactions",
    ]);
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const currency = {
      get: jest.fn((field) => CURRENCY[field]),
    };

    expect(toPublicCurrency(currency)).toEqual({
      id: 2,
      code: "USDT",
      name: "Tether",
      symbol: "$",
      rate: 1000.29,
      is_base: false,
      is_active: true,
      is_default_for_transactions: false,
    });
    expect(currency.get).toHaveBeenCalledWith("id");
  });
});

describe("toPublicChangedBy", () => {
  it("exposes only id, username and email", () => {
    expect(
      toPublicChangedBy({
        ...HISTORY.changed_by,
        name: "Admin",
        password: "hash",
      }),
    ).toEqual({ id: 1, username: "admin", email: "admin@farmamad.com" });
  });

  it("returns null when the user is missing", () => {
    expect(toPublicChangedBy(null)).toBeNull();
    expect(toPublicChangedBy(undefined)).toBeNull();
  });

  it("uses the get() accessors of a Sequelize instance", () => {
    const user = { get: jest.fn((field) => HISTORY.changed_by[field]) };

    expect(toPublicChangedBy(user)).toEqual(HISTORY.changed_by);
  });
});

describe("toPublicHistoryEntry", () => {
  it("serializes the history row with nested changed_by and ISO date", () => {
    expect(toPublicHistoryEntry(HISTORY)).toEqual({
      id: 5,
      currency_id: 2,
      previous_rate: 1000.29,
      new_rate: 1005.75,
      changed_by: { id: 1, username: "admin", email: "admin@farmamad.com" },
      changed_at: "2026-10-29T15:30:00.000Z",
      reason: "Actualización diaria BCV",
    });
  });

  it("keeps null previous_rate, null changed_by and null reason", () => {
    expect(
      toPublicHistoryEntry({
        ...HISTORY,
        previous_rate: null,
        changed_by: null,
        reason: null,
      }),
    ).toEqual({
      id: 5,
      currency_id: 2,
      previous_rate: null,
      new_rate: 1005.75,
      changed_by: null,
      changed_at: "2026-10-29T15:30:00.000Z",
      reason: null,
    });
  });

  it("keeps a string changed_at and the documented key order", () => {
    const result = toPublicHistoryEntry({
      ...HISTORY,
      changed_at: "2026-10-29T15:30:00.000Z",
    });

    expect(result.changed_at).toBe("2026-10-29T15:30:00.000Z");
    expect(Object.keys(result)).toEqual([
      "id",
      "currency_id",
      "previous_rate",
      "new_rate",
      "changed_by",
      "changed_at",
      "reason",
    ]);
  });
});
