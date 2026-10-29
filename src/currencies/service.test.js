const { createCurrencyService } = require("./service");

const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };

/**
 * Builds a repository double whose transaction runs the callback.
 * @returns {object} Repository double.
 */
function repositoryDouble() {
  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    create: jest.fn(),
    createHistory: jest.fn(),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    listHistory: jest.fn(),
  };
}

describe("createCurrencyService.createCurrency", () => {
  it("creates the currency as non-base and active inside a transaction", async () => {
    const repository = repositoryDouble();
    const created = {
      id: 4,
      code: "EUR",
      name: "Euro",
      symbol: "€",
      rate: "970.500000",
      is_base: false,
      is_active: true,
    };
    repository.create.mockResolvedValue(created);
    repository.createHistory.mockResolvedValue({ id: 1 });
    const service = createCurrencyService({ repository });

    await expect(
      service.createCurrency(
        {
          code: "eur",
          name: "Euro",
          symbol: "€",
          rate: 970.5,
          is_base: true,
          is_active: false,
        },
        1,
      ),
    ).resolves.toBe(created);

    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        rate: 970.5,
        is_base: false,
        is_active: true,
      },
      { transaction: TRANSACTION },
    );
    expect(repository.createHistory).toHaveBeenCalledWith(
      {
        currency_id: 4,
        previous_rate: null,
        new_rate: "970.500000",
        changed_by: 1,
        reason: null,
      },
      { transaction: TRANSACTION },
    );
  });

  it("uses null when no authenticated user is provided", async () => {
    const repository = repositoryDouble();
    repository.create.mockResolvedValue({ id: 4, rate: "1.000000" });
    repository.createHistory.mockResolvedValue({ id: 1 });
    const service = createCurrencyService({ repository });

    await service.createCurrency({
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
      rate: 1,
    });

    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({ changed_by: null }),
      { transaction: TRANSACTION },
    );
  });

  it("propagates a failure of the history insert so the transaction rolls back", async () => {
    const repository = repositoryDouble();
    const error = new Error("history failed");
    repository.create.mockResolvedValue({ id: 4, rate: "1.000000" });
    repository.createHistory.mockRejectedValue(error);
    const service = createCurrencyService({ repository });

    await expect(
      service.createCurrency(
        { code: "VES", name: "Bolívar", symbol: "Bs", rate: 1 },
        1,
      ),
    ).rejects.toBe(error);
    expect(repository.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("createCurrencyService.updateCurrency", () => {
  it("updates the rate and appends history inside one transaction", async () => {
    const repository = repositoryDouble();
    const currency = { id: 2, rate: "1000.290000", is_base: false };
    const updated = { ...currency, rate: "1005.750000" };
    repository.update.mockResolvedValue(updated);
    repository.createHistory.mockResolvedValue({ id: 5 });
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(
        currency,
        { rate: 1005.75, reason: "Actualización diaria BCV" },
        1,
      ),
    ).resolves.toBe(updated);

    expect(repository.update).toHaveBeenCalledWith(
      currency,
      { rate: 1005.75 },
      { transaction: TRANSACTION },
    );
    expect(repository.createHistory).toHaveBeenCalledWith(
      {
        currency_id: 2,
        previous_rate: 1000.29,
        new_rate: 1005.75,
        changed_by: 1,
        reason: "Actualización diaria BCV",
      },
      { transaction: TRANSACTION },
    );
  });

  it("updates name, symbol and is_active without history when rate does not change", async () => {
    const repository = repositoryDouble();
    const currency = { id: 2, rate: "1000.290000", is_base: false };
    const updated = { ...currency, name: "Tether", is_active: true };
    repository.update.mockResolvedValue(updated);
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(
        currency,
        {
          name: "Tether",
          symbol: "$",
          rate: 1000.29,
          is_active: true,
          reason: "ignored",
        },
        1,
      ),
    ).resolves.toBe(updated);

    expect(repository.update).toHaveBeenCalledWith(
      currency,
      { name: "Tether", symbol: "$", is_active: true },
      { transaction: TRANSACTION },
    );
    expect(repository.createHistory).not.toHaveBeenCalled();
  });

  it("does not insert history when only name or symbol change", async () => {
    const repository = repositoryDouble();
    const currency = { id: 2, rate: "1000.290000", is_base: false };
    repository.update.mockResolvedValue(currency);
    const service = createCurrencyService({ repository });

    await service.updateCurrency(currency, { name: "Tether", symbol: "$" }, 1);

    expect(repository.update).toHaveBeenCalledWith(
      currency,
      { name: "Tether", symbol: "$" },
      { transaction: TRANSACTION },
    );
    expect(repository.createHistory).not.toHaveBeenCalled();
  });

  it("allows the base currency to keep rate 1 without history", async () => {
    const repository = repositoryDouble();
    const currency = { id: 1, rate: "1.000000", is_base: true };
    repository.update.mockResolvedValue(currency);
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(currency, { name: "Bolívar", rate: 1 }, 1),
    ).resolves.toBe(currency);

    expect(repository.update).toHaveBeenCalledWith(
      currency,
      { name: "Bolívar" },
      { transaction: TRANSACTION },
    );
    expect(repository.createHistory).not.toHaveBeenCalled();
  });

  it("rejects changing the base currency rate to a value other than 1", async () => {
    const repository = repositoryDouble();
    const currency = { id: 1, rate: "1.000000", is_base: true };
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(currency, { rate: 2 }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Base currency rate cannot be changed" },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects deactivating the base currency", async () => {
    const repository = repositoryDouble();
    const currency = { id: 1, rate: "1.000000", is_base: true };
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(currency, { is_active: false }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Base currency cannot be deactivated" },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("propagates a failure of the history insert", async () => {
    const repository = repositoryDouble();
    const currency = { id: 2, rate: "1000.290000", is_base: false };
    const error = new Error("history failed");
    repository.update.mockResolvedValue(currency);
    repository.createHistory.mockRejectedValue(error);
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(currency, { rate: 1005.75 }, 1),
    ).rejects.toBe(error);
    expect(repository.transaction).toHaveBeenCalledTimes(1);
  });

  it("uses null when no authenticated user is provided", async () => {
    const repository = repositoryDouble();
    const currency = { id: 2, rate: "1000.290000", is_base: false };
    repository.update.mockResolvedValue(currency);
    repository.createHistory.mockResolvedValue({ id: 5 });
    const service = createCurrencyService({ repository });

    await service.updateCurrency(currency, { rate: 1005.75 });

    expect(repository.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({ changed_by: null }),
      { transaction: TRANSACTION },
    );
  });
});
