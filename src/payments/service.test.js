const { createPaymentService, isUsableMethod, toCents } = require("./service");

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

describe("payment service helpers", () => {
  it("rounds to cents", () => {
    expect(toCents("100.005")).toBe(100.01);
    expect(toCents(0.1 + 0.2)).toBe(0.3);
  });

  it("accepts only active methods, types and currencies", () => {
    expect(isUsableMethod(METHOD)).toBe(true);
    expect(isUsableMethod(null)).toBe(false);
    expect(isUsableMethod({ ...METHOD, is_active: false })).toBe(false);
    expect(
      isUsableMethod({
        ...METHOD,
        method_payment_type: {
          ...METHOD.method_payment_type,
          is_active: false,
        },
      }),
    ).toBe(false);
    expect(
      isUsableMethod({
        ...METHOD,
        method_payment_type: {
          ...METHOD.method_payment_type,
          currency: { ...CURRENCY, is_active: false },
        },
      }),
    ).toBe(false);
  });
});

describe("payment service update", () => {
  const payment = {
    id: 1,
    customer_id: 8,
    method_payment_id: 3,
    currency_id: 2,
    amount: "100.00",
  };

  it("updates only metadata and responds with the reloaded payment", async () => {
    const repository = buildRepository();
    const service = createPaymentService({ repository });

    await service.updatePayment(payment, { notes: "nuevo" });

    expect(repository.update).toHaveBeenCalledWith(
      payment,
      { notes: "nuevo" },
      { transaction: TRANSACTION },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      transaction: TRANSACTION,
    });
  });

  it("replaces the reference image keeping the previous row", async () => {
    const repository = buildRepository();
    const imageProcessor = jest.fn().mockResolvedValue({
      image: {
        reference: "payment-reference-2",
        pathname: "/uploads/payments/b.png",
        url: "http://example.test/b.png",
        thumbnail: "http://example.test/b-thumb.webp",
      },
      files: ["/tmp/b.png", "/tmp/b-thumb.webp"],
    });
    const service = createPaymentService({
      repository,
      imageProcessor,
    });

    await service.updatePayment(
      payment,
      { notes: "nuevo" },
      {
        file: { buffer: Buffer.from("image") },
      },
    );

    expect(repository.createImage).toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      payment,
      { notes: "nuevo", reference_image_id: 20 },
      { transaction: TRANSACTION },
    );
  });

  it("accepts identical immutable values and skips the update", async () => {
    const repository = buildRepository();
    const service = createPaymentService({ repository });

    await service.updatePayment(payment, {
      customer_id: 8,
      method_payment_id: 3,
      currency_id: 2,
      amount: 100,
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it.each([
    ["customer_id", 9],
    ["method_payment_id", 4],
    ["currency_id", 3],
    ["amount", 99],
  ])("rejects a different %s with 422", async (field, value) => {
    const repository = buildRepository();
    const service = createPaymentService({ repository });

    await expect(
      service.updatePayment(payment, { [field]: value }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { [field]: `${field} cannot be changed` } },
    });
  });

  it("responds 409 when the payment has allocations", async () => {
    const repository = buildRepository({
      countAllocations: jest.fn().mockResolvedValue(1),
    });

    await expect(
      createPaymentService({ repository }).updatePayment(payment, {
        notes: "x",
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Payment has allocations" },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
