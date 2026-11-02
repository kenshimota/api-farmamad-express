const { createPaymentService } = require("./service");

const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };

/**
 * Builds a payment repository double oriented to deletion.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function buildRepository(overrides = {}) {
  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    countAllocations: jest.fn().mockResolvedValue(0),
    findDeposit: jest.fn().mockResolvedValue({ id: 10, wallet_id: 5 }),
    findWalletForUpdate: jest
      .fn()
      .mockResolvedValue({ id: 5, balance: "100.00" }),
    incrementBalance: jest.fn(),
    removeWalletTransaction: jest.fn(),
    remove: jest.fn(),
    ...overrides,
  };
}

describe("payment service delete", () => {
  const payment = { id: 1, amount: "100.00" };

  it("reverts the deposit and deletes the payment", async () => {
    const repository = buildRepository();
    const service = createPaymentService({ repository });

    await service.deletePayment(payment);

    expect(repository.incrementBalance).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      -100,
      { transaction: TRANSACTION },
    );
    expect(repository.removeWalletTransaction).toHaveBeenCalledWith(
      { id: 10, wallet_id: 5 },
      { transaction: TRANSACTION },
    );
    expect(repository.remove).toHaveBeenCalledWith(payment, {
      transaction: TRANSACTION,
    });
  });

  it("refuses to leave a negative balance", async () => {
    const repository = buildRepository({
      findWalletForUpdate: jest
        .fn()
        .mockResolvedValue({ id: 5, balance: "40.00" }),
    });

    await expect(
      createPaymentService({ repository }).deletePayment(payment),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Wallet balance would become negative" },
    });
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("responds 409 for allocations or a missing deposit", async () => {
    const allocations = buildRepository({
      countAllocations: jest.fn().mockResolvedValue(1),
    });
    await expect(
      createPaymentService({ repository: allocations }).deletePayment(payment),
    ).rejects.toMatchObject({ status: 409 });

    const missingDeposit = buildRepository({
      findDeposit: jest.fn().mockResolvedValue(null),
    });
    await expect(
      createPaymentService({
        repository: missingDeposit,
      }).deletePayment(payment),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Payment deposit not found" },
    });
  });
});
