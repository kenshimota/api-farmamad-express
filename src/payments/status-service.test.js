const { createPaymentStatusService } = require("./status-service");

const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const CURRENCY = { id: 2, code: "USDT", name: "Tether", symbol: "$" };
const PAYMENT = {
  id: 10,
  customer_id: 8,
  currency_id: 2,
  amount: "100.00",
  status: "pending",
  rejection_reason: null,
  update: jest.fn().mockResolvedValue(undefined),
};
const WALLET = {
  id: 5,
  customer_id: 8,
  currency_id: 2,
  balance: "0.00",
  currency: CURRENCY,
};
const CREDITED = {
  ...WALLET,
  balance: "100.00",
};

/**
 * Builds a repository double with successful defaults.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} The repository double.
 */
function buildRepository(overrides = {}) {
  return {
    transaction: jest.fn((callback) => callback(TRANSACTION)),
    findPaymentForUpdate: jest.fn().mockResolvedValue({ ...PAYMENT }),
    findById: jest
      .fn()
      .mockResolvedValue({ ...PAYMENT, status: "conciliated" }),
    findOrCreateWallet: jest.fn().mockResolvedValue(WALLET),
    incrementBalance: jest.fn().mockResolvedValue(CREDITED),
    createWalletTransaction: jest.fn().mockResolvedValue({ id: 1 }),
    createStatusHistory: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn(),
    ...overrides,
  };
}

describe("payment status service", () => {
  it("credits the wallet and appends the deposit when conciliating", async () => {
    const repository = buildRepository();
    const service = createPaymentStatusService({ repository });

    const result = await service.changeStatus(
      10,
      { status: "conciliated", reason: "Banco verificado" },
      1,
    );

    expect(result).toEqual({
      payment: { ...PAYMENT, status: "conciliated" },
      wallet: CREDITED,
    });
    expect(repository.findOrCreateWallet).toHaveBeenCalledWith(8, 2, {
      transaction: TRANSACTION,
    });
    expect(repository.incrementBalance).toHaveBeenCalledWith(WALLET, 100, {
      transaction: TRANSACTION,
    });
    expect(repository.createWalletTransaction).toHaveBeenCalledWith(
      {
        wallet_id: 5,
        transaction_type: "deposit",
        amount: 100,
        balance_after: 100,
        payment_id: 10,
        invoice_id: null,
        payment_allocation_id: null,
        description: "Banco verificado",
        created_by_user_id: 1,
      },
      { transaction: TRANSACTION },
    );
    expect(repository.createStatusHistory).toHaveBeenCalledWith(
      {
        payment_id: 10,
        from_status: "pending",
        to_status: "conciliated",
        reason: "Banco verificado",
        actor_user_id: 1,
        metadata: null,
      },
      { transaction: TRANSACTION },
    );
  });

  it("rejects a payment with its reason and never touches the wallet", async () => {
    const payment = { ...PAYMENT };
    const repository = buildRepository({
      findPaymentForUpdate: jest.fn().mockResolvedValue(payment),
      findById: jest.fn().mockResolvedValue({ ...payment, status: "rejected" }),
    });
    const service = createPaymentStatusService({ repository });

    const result = await service.changeStatus(
      10,
      { status: "rejected", reason: "Monto distinto" },
      1,
    );

    expect(result.wallet).toBeNull();
    expect(repository.update).toHaveBeenCalledWith(
      payment,
      { status: "rejected", rejection_reason: "Monto distinto" },
      { transaction: TRANSACTION },
    );
    expect(repository.findOrCreateWallet).not.toHaveBeenCalled();
    expect(repository.incrementBalance).not.toHaveBeenCalled();
    expect(repository.createWalletTransaction).not.toHaveBeenCalled();
    expect(repository.createStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        from_status: "pending",
        to_status: "rejected",
        reason: "Monto distinto",
      }),
      { transaction: TRANSACTION },
    );
  });

  it("answers 404 for an unknown payment", async () => {
    const repository = buildRepository({
      findPaymentForUpdate: jest.fn().mockResolvedValue(null),
    });

    await expect(
      createPaymentStatusService({ repository }).changeStatus(
        999,
        { status: "conciliated" },
        1,
      ),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Payment not found" },
    });
  });

  it("answers 422 for a repeated or terminal transition", async () => {
    const repository = buildRepository({
      findPaymentForUpdate: jest
        .fn()
        .mockResolvedValue({ ...PAYMENT, status: "conciliated" }),
    });

    await expect(
      createPaymentStatusService({ repository }).changeStatus(
        10,
        { status: "conciliated" },
        1,
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { status: "Invalid status transition" } },
    });

    expect(repository.findOrCreateWallet).not.toHaveBeenCalled();
    expect(repository.createStatusHistory).not.toHaveBeenCalled();
  });
});

describe("payment status service helpers", () => {
  it("lists the history through the repository", async () => {
    const repository = buildRepository({
      listStatusHistory: jest.fn().mockResolvedValue([{ id: 1 }]),
    });

    await expect(
      createPaymentStatusService({ repository }).listHistory(10),
    ).resolves.toEqual([{ id: 1 }]);
    expect(repository.listStatusHistory).toHaveBeenCalledWith(10);
  });

  it("rejects an unknown status code", async () => {
    const repository = buildRepository();

    await expect(
      createPaymentStatusService({ repository }).changeStatus(
        10,
        { status: "other" },
        1,
      ),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { status: "Invalid status" } },
    });
  });

  it("normalizes optional and required reasons", () => {
    const {
      normalizeOptionalReason,
      normalizeRejectedReason,
    } = require("./status-service");

    expect(normalizeOptionalReason("  hola  ")).toBe("hola");
    expect(normalizeOptionalReason("   ")).toBeNull();
    expect(normalizeOptionalReason(undefined)).toBeNull();
    expect(normalizeRejectedReason("  motivo  ")).toBe("motivo");
    expect(() => normalizeRejectedReason("  x ")).toThrow(
      expect.objectContaining({
        status: 422,
        body: {
          errors: {
            reason: "reason is required when the payment is rejected",
          },
        },
      }),
    );
  });
});
