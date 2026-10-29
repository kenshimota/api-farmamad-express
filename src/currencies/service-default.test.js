const { createCurrencyService } = require("./service");

/**
 * Builds a repository double whose update resolves a value.
 * @returns {object} Repository double.
 */
function repositoryDouble() {
  return {
    transaction: jest.fn((callback) => callback({})),
    update: jest.fn(),
  };
}

describe("default transaction currency protection", () => {
  it("rejects deactivating the default currency on update", async () => {
    const repository = repositoryDouble();
    const currency = {
      id: 3,
      rate: "889.890000",
      is_base: false,
      is_default_for_transactions: true,
    };
    const service = createCurrencyService({ repository });

    await expect(
      service.updateCurrency(currency, { is_active: false }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: {
        message: "Default transaction currency cannot be deactivated",
      },
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it("deactivates a regular currency but protects the default one", async () => {
    const repository = repositoryDouble();
    const regular = { id: 2, is_base: false };
    const fallback = {
      id: 3,
      is_base: false,
      is_default_for_transactions: true,
    };
    repository.update.mockResolvedValue({ ...regular, is_active: false });
    const service = createCurrencyService({ repository });

    await service.deactivateCurrency(regular);
    expect(repository.update).toHaveBeenCalledWith(regular, {
      is_active: false,
    });

    await expect(service.deactivateCurrency(fallback)).rejects.toMatchObject({
      status: 409,
      body: {
        message: "Default transaction currency cannot be deactivated",
      },
    });
  });
});
