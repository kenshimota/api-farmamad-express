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
    createWalletTransaction: jest.fn(),
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

describe("payment service create", () => {
  it("credits the wallet and appends the deposit in one transaction", async () => {
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
      wallet: { id: 5, balance: "100.00", currency: CURRENCY },
    });

    expect(repository.incrementBalance).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5 }),
      100,
      { transaction: TRANSACTION },
    );
    expect(repository.create).toHaveBeenCalledWith(
      {
        customer_id: 8,
        method_payment_id: 3,
        currency_id: 2,
        amount: 100,
        paid_at: expect.any(Date),
        reference: "TRX",
        notes: null,
        created_by_user_id: 1,
      },
      { transaction: TRANSACTION },
    );
    expect(repository.createWalletTransaction).toHaveBeenCalledWith(
      {
        wallet_id: 5,
        transaction_type: "deposit",
        amount: 100,
        balance_after: 100,
        payment_id: 1,
        invoice_id: null,
        payment_allocation_id: null,
        description: "TRX",
        created_by_user_id: 1,
      },
      { transaction: TRANSACTION },
    );
  });

  it("uses the resulting wallet balance for balance_after", async () => {
    const repository = buildRepository();
    repository.findOrCreateWallet.mockResolvedValue({
      id: 5,
      balance: "50.00",
    });
    repository.incrementBalance.mockResolvedValue({ id: 5, balance: "57.50" });
    const service = createPaymentService({ repository });

    await service.createPayment(
      { customer_id: 8, method_payment_id: 3, amount: 7.5 },
      1,
    );

    expect(repository.createWalletTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ balance_after: 57.5 }),
      { transaction: TRANSACTION },
    );
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
    expect(repository.incrementBalance).not.toHaveBeenCalled();
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
