const { createWalletService } = require("./service");

describe("wallet service", () => {
  it("delegates lists, details and movements", async () => {
    const repository = {
      findByCustomer: jest.fn().mockResolvedValue([{ id: 5 }]),
      findById: jest.fn().mockResolvedValue({ id: 5 }),
      listTransactions: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    const service = createWalletService({ repository });

    await expect(service.listWallets(8)).resolves.toEqual([{ id: 5 }]);
    await expect(service.getWallet(5)).resolves.toEqual({ id: 5 });
    await expect(
      service.listTransactions(5, { includeCreatedBy: true }),
    ).resolves.toEqual([{ id: 1 }]);

    expect(repository.findByCustomer).toHaveBeenCalledWith(8);
    expect(repository.findById).toHaveBeenCalledWith(5);
    expect(repository.listTransactions).toHaveBeenCalledWith(5, {
      includeCreatedBy: true,
    });
  });
});
