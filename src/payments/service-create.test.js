const { createPaymentService } = require("./service");

const CURRENCY = { id: 2, is_active: true };
const METHOD = {
  id: 3,
  is_active: true,
  method_payment_type: {
    id: 1,
    is_active: true,
    currency_id: 2,
    currency: CURRENCY,
  },
};
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };

/**
 * Builds a payment repository double with successful defaults.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function buildRepository(overrides = {}) {
  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    list: jest.fn().mockResolvedValue([]),
    findCustomer: jest.fn().mockResolvedValue({ id: 8 }),
    findMethod: jest.fn().mockResolvedValue(METHOD),
    findOrCreateWallet: jest
      .fn()
      .mockResolvedValue({ id: 5, balance: "0.00", currency: CURRENCY }),
    incrementBalance: jest
      .fn()
      .mockResolvedValue({ id: 5, balance: "100.00", currency: CURRENCY }),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    createImage: jest.fn().mockResolvedValue({ id: 20 }),
    createWalletTransaction: jest.fn(),
    createStatusHistory: jest.fn(),
    countAllocations: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    ...overrides,
  };
}

describe("payment service create", () => {
  it("creates a pending payment without touching the wallet", async () => {
    const repository = buildRepository();
    const service = createPaymentService({ repository });

    await expect(
      service.createPayment(
        {
          customer_id: 8,
          method_payment_id: 3,
          amount: 100,
          reference: "TRX",
          notes: null,
        },
        1,
      ),
    ).resolves.toEqual({
      payment: { id: 1 },
      wallet: null,
    });

    expect(repository.findOrCreateWallet).not.toHaveBeenCalled();
    expect(repository.incrementBalance).not.toHaveBeenCalled();
    expect(repository.createWalletTransaction).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      {
        customer_id: 8,
        method_payment_id: 3,
        currency_id: 2,
        amount: 100,
        paid_at: expect.any(Date),
        reference: "TRX",
        notes: null,
        status: "pending",
        rejection_reason: null,
        reference_image_id: null,
        created_by_user_id: 1,
      },
      { transaction: TRANSACTION },
    );
    expect(repository.createStatusHistory).toHaveBeenCalledWith(
      {
        payment_id: 1,
        from_status: null,
        to_status: "pending",
        reason: null,
        actor_user_id: 1,
        metadata: null,
      },
      { transaction: TRANSACTION },
    );
  });

  it("stores an optional reference image in the same transaction", async () => {
    const repository = buildRepository();
    const imageProcessor = jest.fn().mockResolvedValue({
      image: {
        reference: "payment-reference-1",
        pathname: "/uploads/payments/a.png",
        url: "http://localhost:3001/uploads/payments/a.png",
        thumbnail: "http://localhost:3001/uploads/payments/a-thumb.webp",
      },
      files: ["/tmp/a.png", "/tmp/a-thumb.webp"],
    });
    const fileRemover = jest.fn().mockResolvedValue(undefined);
    const service = createPaymentService({
      repository,
      imageProcessor,
      fileRemover,
    });

    await service.createPayment(
      { customer_id: 8, method_payment_id: 3, amount: 1 },
      1,
      { file: { buffer: Buffer.from("image") } },
    );

    expect(imageProcessor).toHaveBeenCalledWith({
      buffer: Buffer.from("image"),
    });
    expect(repository.createImage).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "payment-reference-1" }),
      { transaction: TRANSACTION },
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ reference_image_id: 20 }),
      { transaction: TRANSACTION },
    );
    expect(fileRemover).not.toHaveBeenCalled();
  });

  it("removes the new files when the transaction fails", async () => {
    const repository = buildRepository({
      create: jest.fn().mockRejectedValue(new Error("db down")),
    });
    const imageProcessor = jest.fn().mockResolvedValue({
      image: {
        reference: "payment-reference-1",
        pathname: "/uploads/payments/a.png",
        url: "http://example.test/a.png",
        thumbnail: "http://example.test/a-thumb.webp",
      },
      files: ["/tmp/a.png", "/tmp/a-thumb.webp"],
    });
    const fileRemover = jest.fn().mockResolvedValue(undefined);
    const service = createPaymentService({
      repository,
      imageProcessor,
      fileRemover,
    });

    await expect(
      service.createPayment(
        { customer_id: 8, method_payment_id: 3, amount: 1 },
        1,
        { file: { buffer: Buffer.from("image") } },
      ),
    ).rejects.toThrow("db down");

    expect(fileRemover).toHaveBeenCalledWith([
      "/tmp/a.png",
      "/tmp/a-thumb.webp",
    ]);
  });

  it("responds 404 for a missing customer or method", async () => {
    const missingCustomer = buildRepository({
      findCustomer: jest.fn().mockResolvedValue(null),
    });
    await expect(
      createPaymentService({ repository: missingCustomer }).createPayment(
        { customer_id: 99, method_payment_id: 3, amount: 1 },
        1,
      ),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Customer not found" },
    });

    const missingMethod = buildRepository({
      findMethod: jest.fn().mockResolvedValue(null),
    });
    await expect(
      createPaymentService({ repository: missingMethod }).createPayment(
        { customer_id: 8, method_payment_id: 99, amount: 1 },
        1,
      ),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Payment method not found" },
    });
  });

  it("rejects an inactive method with 422", async () => {
    const repository = buildRepository({
      findMethod: jest.fn().mockResolvedValue({ ...METHOD, is_active: false }),
    });

    await expect(
      createPaymentService({ repository }).createPayment(
        { customer_id: 8, method_payment_id: 3, amount: 1 },
        1,
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { method_payment_id: "Invalid payment method" } },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
