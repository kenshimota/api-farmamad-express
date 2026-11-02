const {
  ALLOCATION,
  INVOICE,
  NOW,
  PAYMENT,
  TRANSACTION,
  WALLET,
  buildService,
  repositoryDouble,
} = require("../../test/helpers/invoice-payments-doubles");

describe("applyPayment", () => {
  it("applies a payment atomically and returns the allocation and invoice", async () => {
    const { repository, service } = buildService();

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).resolves.toEqual({
      allocation: ALLOCATION,
      invoice: expect.objectContaining({
        id: 1,
        paid_amount: 20,
        payment_status: "partial",
      }),
    });

    expect(repository.findInvoiceForUpdate).toHaveBeenCalledWith(
      1,
      TRANSACTION,
    );
    expect(repository.findPaymentForUpdate).toHaveBeenCalledWith(
      5,
      TRANSACTION,
    );
    expect(repository.findWalletForUpdate).toHaveBeenCalledWith(
      8,
      2,
      TRANSACTION,
    );
    expect(repository.createAllocation).toHaveBeenCalledWith(
      {
        payment_id: 5,
        invoice_id: 1,
        amount: 10,
        applied_amount: 20,
        exchange_rate: 2,
        allocated_at: NOW,
        created_by_user_id: 1,
      },
      { transaction: TRANSACTION },
    );
    expect(repository.debitWallet).toHaveBeenCalledWith(WALLET, 10, {
      transaction: TRANSACTION,
    });
    expect(repository.createWalletTransaction).toHaveBeenCalledWith(
      {
        wallet_id: 7,
        transaction_type: "invoice_payment",
        amount: -10,
        balance_after: "90.00",
        payment_id: 5,
        invoice_id: 1,
        payment_allocation_id: 11,
        description: null,
        created_by_user_id: 1,
      },
      { transaction: TRANSACTION },
    );
    expect(repository.updateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { paid_amount: 20, payment_status: "partial" },
      { transaction: TRANSACTION },
    );
    expect(repository.reloadAllocation).toHaveBeenCalledWith(11, TRANSACTION);
  });

  it("marks the invoice as paid when the applied amount reaches the total", async () => {
    const { repository, service } = buildService();

    await service.applyPayment(1, { payment_id: 5, amount: 12.5 }, 1);

    expect(repository.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      { paid_amount: 25, payment_status: "paid" },
      { transaction: TRANSACTION },
    );
  });

  it("answers 404 when the invoice does not exist", async () => {
    const { service } = buildService(
      repositoryDouble({
        findInvoiceForUpdate: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      service.applyPayment(99, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Invoice not found" },
    });
  });

  it("answers 404 when the payment does not exist", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findPaymentForUpdate: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 99, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Payment not found" },
    });
    expect(repository.createAllocation).not.toHaveBeenCalled();
  });

  it("answers 422 when the payment belongs to another customer", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findPaymentForUpdate: jest
          .fn()
          .mockResolvedValue({ ...PAYMENT, customer_id: 9 }),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 422,
      body: {
        errors: { payment_id: "Payment does not belong to invoice customer" },
      },
    });
    expect(repository.createAllocation).not.toHaveBeenCalled();
  });

  it("answers 409 when the invoice is already paid", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findInvoiceForUpdate: jest.fn().mockResolvedValue({
          ...INVOICE,
          total: "25.00",
          paid_amount: "25.00",
          payment_status: "paid",
        }),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Invoice is already paid" },
    });
    expect(repository.createAllocation).not.toHaveBeenCalled();
  });

  it("answers 409 when the payment is already allocated to the invoice", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findAllocation: jest.fn().mockResolvedValue({ ...ALLOCATION }),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Payment already allocated to this invoice" },
    });
    expect(repository.createAllocation).not.toHaveBeenCalled();
  });

  it("answers 422 when the applied amount exceeds the invoice balance", async () => {
    const { repository, service } = buildService();

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 13 }, 1),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { amount: "Amount exceeds invoice balance" } },
    });
    expect(repository.findWalletForUpdate).not.toHaveBeenCalled();
    expect(repository.createAllocation).not.toHaveBeenCalled();
  });

  it("answers 409 when the wallet has no enough balance", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findWalletForUpdate: jest
          .fn()
          .mockResolvedValue({ ...WALLET, balance: "5.00" }),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Insufficient wallet balance" },
    });
    expect(repository.createAllocation).not.toHaveBeenCalled();
    expect(repository.debitWallet).not.toHaveBeenCalled();
  });

  it("answers 409 when the wallet does not exist", async () => {
    const { service } = buildService(
      repositoryDouble({
        findWalletForUpdate: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toMatchObject({
      status: 409,
      body: { message: "Insufficient wallet balance" },
    });
  });

  it("accepts an amount equal to both the wallet and invoice balances", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findWalletForUpdate: jest
          .fn()
          .mockResolvedValue({ ...WALLET, balance: "10.00" }),
        findInvoiceForUpdate: jest.fn().mockResolvedValue({
          ...INVOICE,
          total: "20.00",
        }),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).resolves.toBeDefined();
    expect(repository.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      { paid_amount: 20, payment_status: "paid" },
      { transaction: TRANSACTION },
    );
  });

  it("propagates a failure and never updates the invoice", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        createWalletTransaction: jest
          .fn()
          .mockRejectedValue(new Error("movement failed")),
      }),
    );

    await expect(
      service.applyPayment(1, { payment_id: 5, amount: 10 }, 1),
    ).rejects.toThrow("movement failed");
    expect(repository.updateInvoice).not.toHaveBeenCalled();
  });
});
