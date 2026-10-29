const {
  DEFAULT_TRANSACTION_MESSAGE,
  INVALID_CURRENCY_MESSAGE,
  findActiveCurrency,
  findDefaultTransactionCurrency,
  resolveDefaultTransactionCurrency,
  resolveTransactionCurrency,
} = require("./default");

/**
 * Builds a currency model double.
 * @param {object|null} result - Result of findOne.
 * @returns {object} Model double.
 */
function modelDouble(result) {
  return { findOne: jest.fn().mockResolvedValue(result) };
}

const DEFAULT_CURRENCY = {
  id: 3,
  code: "USD_BCV",
  name: "Dólar BCV",
  symbol: "$",
};

describe("findDefaultTransactionCurrency", () => {
  it("queries the active default currency", async () => {
    const model = modelDouble(DEFAULT_CURRENCY);

    await expect(findDefaultTransactionCurrency({ model })).resolves.toBe(
      DEFAULT_CURRENCY,
    );
    expect(model.findOne).toHaveBeenCalledWith({
      where: { is_default_for_transactions: true, is_active: true },
    });
  });
});

describe("resolveDefaultTransactionCurrency", () => {
  it("returns the configured default currency", async () => {
    const model = modelDouble(DEFAULT_CURRENCY);

    await expect(resolveDefaultTransactionCurrency({ model })).resolves.toBe(
      DEFAULT_CURRENCY,
    );
  });

  it("throws a 503 when there is no active default currency", async () => {
    const model = modelDouble(null);

    await expect(
      resolveDefaultTransactionCurrency({ model }),
    ).rejects.toMatchObject({
      status: 503,
      body: { message: DEFAULT_TRANSACTION_MESSAGE },
    });
  });
});

describe("findActiveCurrency", () => {
  it("only accepts active currencies", async () => {
    const model = modelDouble(DEFAULT_CURRENCY);

    await expect(findActiveCurrency(3, { model })).resolves.toBe(
      DEFAULT_CURRENCY,
    );
    expect(model.findOne).toHaveBeenCalledWith({
      where: { id: 3, is_active: true },
    });
  });
});

describe("resolveTransactionCurrency", () => {
  it("uses the default currency when the id is omitted", async () => {
    const model = modelDouble(DEFAULT_CURRENCY);

    await expect(
      resolveTransactionCurrency(undefined, { model }),
    ).resolves.toBe(DEFAULT_CURRENCY);
  });

  it("returns an explicit active currency", async () => {
    const model = modelDouble(DEFAULT_CURRENCY);

    await expect(resolveTransactionCurrency(3, { model })).resolves.toBe(
      DEFAULT_CURRENCY,
    );
  });

  it("throws a 422 for a missing or inactive currency", async () => {
    const model = modelDouble(null);

    await expect(
      resolveTransactionCurrency(99, { model }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { currency_id: INVALID_CURRENCY_MESSAGE } },
    });
  });
});
