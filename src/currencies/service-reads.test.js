const { createCurrencyService } = require("./service");

/**
 * Builds a repository double whose transaction runs the callback.
 * @returns {object} Repository double.
 */
function repositoryDouble() {
  return {
    transaction: jest.fn((callback) => callback()),
    create: jest.fn(),
    createHistory: jest.fn(),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    listHistory: jest.fn(),
  };
}

describe("createCurrencyService reads", () => {
  it("lists currencies and forwards the inactive filter", async () => {
    const repository = repositoryDouble();
    repository.list.mockResolvedValue([{ id: 1 }]);
    const service = createCurrencyService({ repository });

    await expect(service.listCurrencies()).resolves.toEqual([{ id: 1 }]);
    expect(repository.list).toHaveBeenCalledWith({ includeInactive: false });

    await service.listCurrencies({ includeInactive: true });
    expect(repository.list).toHaveBeenLastCalledWith({
      includeInactive: true,
    });
  });

  it("reads the rate history of a currency", async () => {
    const repository = repositoryDouble();
    repository.listHistory.mockResolvedValue([{ id: 5 }]);
    const service = createCurrencyService({ repository });

    await expect(service.getRateHistory(2)).resolves.toEqual([{ id: 5 }]);
    expect(repository.listHistory).toHaveBeenCalledWith(2);
  });
});

describe("createCurrencyService.deactivateCurrency", () => {
  it("marks a non-base currency as inactive", async () => {
    const repository = repositoryDouble();
    const currency = { id: 2, is_base: false, is_active: true };
    const updated = { ...currency, is_active: false };
    repository.update.mockResolvedValue(updated);
    const service = createCurrencyService({ repository });

    await expect(service.deactivateCurrency(currency)).resolves.toBe(updated);
    expect(repository.update).toHaveBeenCalledWith(currency, {
      is_active: false,
    });
  });

  it("refuses to deactivate the base currency", async () => {
    const repository = repositoryDouble();
    const service = createCurrencyService({ repository });

    await expect(
      service.deactivateCurrency({ id: 1, is_base: true }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Base currency cannot be deactivated" },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
