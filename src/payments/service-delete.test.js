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
    findImage: jest.fn().mockResolvedValue(null),
    countImageReferences: jest.fn().mockResolvedValue(0),
    removeImage: jest.fn(),
    ...overrides,
  };
}

describe("payment service delete", () => {
  const payment = {
    id: 1,
    amount: "100.00",
    status: "conciliated",
    reference_image_id: null,
  };

  it("reverts the deposit of a conciliated payment and deletes it", async () => {
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

  it("deletes a pending payment without touching the wallet", async () => {
    const repository = buildRepository();
    const pending = { ...payment, status: "pending" };
    const service = createPaymentService({ repository });

    await service.deletePayment(pending);

    expect(repository.findDeposit).not.toHaveBeenCalled();
    expect(repository.incrementBalance).not.toHaveBeenCalled();
    expect(repository.removeWalletTransaction).not.toHaveBeenCalled();
    expect(repository.remove).toHaveBeenCalledWith(pending, {
      transaction: TRANSACTION,
    });
  });

  it("removes an unreferenced reference image after the transaction", async () => {
    const image = {
      id: 20,
      pathname: "/uploads/payments/a.png",
      reference: "payment-reference-a",
    };
    const repository = buildRepository({
      findImage: jest.fn().mockResolvedValue(image),
      countImageReferences: jest.fn().mockResolvedValue(0),
    });
    const imageCleaner = jest.fn().mockResolvedValue(undefined);
    const service = createPaymentService({ repository, imageCleaner });

    await service.deletePayment({
      ...payment,
      status: "pending",
      reference_image_id: 20,
    });

    expect(repository.countImageReferences).toHaveBeenCalledWith(20);
    expect(repository.removeImage).toHaveBeenCalledWith(image);
    expect(imageCleaner).toHaveBeenCalledWith(image);
  });

  it("keeps an image that another payment still references", async () => {
    const repository = buildRepository({
      findImage: jest.fn().mockResolvedValue({ id: 20 }),
      countImageReferences: jest.fn().mockResolvedValue(1),
    });
    const imageCleaner = jest.fn();
    const service = createPaymentService({ repository, imageCleaner });

    await service.deletePayment({
      ...payment,
      status: "pending",
      reference_image_id: 20,
    });

    expect(repository.removeImage).not.toHaveBeenCalled();
    expect(imageCleaner).not.toHaveBeenCalled();
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

  it("responds 409 for allocations", async () => {
    const allocations = buildRepository({
      countAllocations: jest.fn().mockResolvedValue(1),
    });
    await expect(
      createPaymentService({ repository: allocations }).deletePayment(payment),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("keeps the HU-42 guard when a conciliated deposit is missing", async () => {
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
