const {
  INPUT,
  INVOICE,
  ITEM,
  NOW,
  TRANSACTION,
  buildService,
  repositoryDouble,
} = require("../../test/helpers/invoice-service-doubles");

describe("createInvoice", () => {
  it("creates the invoice and its snapshot lines in a transaction", async () => {
    const { repository, service } = buildService();
    repository.findById.mockResolvedValue({ ...INVOICE, items: [ITEM] });

    await expect(service.createInvoice(INPUT)).resolves.toEqual({
      ...INVOICE,
      items: [ITEM],
    });

    expect(repository.hasOrderInvoice).toHaveBeenCalledWith(10, TRANSACTION);
    expect(repository.findPaymentTermById).toHaveBeenCalledWith(3, TRANSACTION);
    expect(repository.nextNumber).toHaveBeenCalledWith(TRANSACTION);
    expect(repository.create).toHaveBeenCalledWith(
      {
        number: 1,
        order_id: 10,
        customer_id: 8,
        invoiced_by_user_id: 1,
        currency_id: 3,
        payment_term_id: 3,
        subtotal: 25,
        tax_amount: 0,
        total: 25,
        paid_amount: 0,
        payment_status: "pending",
        issued_at: NOW,
        due_date: "2026-11-16",
        notes: "Factura",
      },
      { transaction: TRANSACTION },
    );
    expect(repository.createItems).toHaveBeenCalledWith(
      [
        {
          invoice_id: 1,
          order_item_id: 20,
          product_id: 15,
          product_name: "Ibuprofeno 400 mg",
          product_reference: "IBU-400",
          item_state_id: 1,
          item_state_name: "sellable",
          quantity: 2,
          unit_price: 12.5,
          subtotal: 25,
          tax_id: null,
          tax_code: null,
          tax_name: null,
          tax_rate: 0,
          tax_amount: 0,
          total: 25,
        },
      ],
      { transaction: TRANSACTION },
    );
    expect(repository.findById).toHaveBeenCalledWith(1, {
      includeItems: true,
      includeInvoicedBy: true,
      transaction: TRANSACTION,
    });
  });

  it("answers 409 when the order already has an invoice", async () => {
    const { repository, service } = buildService(
      repositoryDouble({ hasOrderInvoice: jest.fn().mockResolvedValue(true) }),
    );

    await expect(service.createInvoice(INPUT)).rejects.toMatchObject({
      status: 409,
      body: { message: "Order already has an invoice" },
    });
    expect(repository.nextNumber).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("skips the order uniqueness check when there is no order_id", async () => {
    const { repository, service } = buildService();
    const { order_id, ...withoutOrder } = INPUT;

    await service.createInvoice(withoutOrder);

    expect(repository.hasOrderInvoice).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: null }),
      { transaction: TRANSACTION },
    );
  });

  it("calculates subtotal, total and line subtotals from the items", async () => {
    const { repository, service } = buildService();
    const { subtotal, total, ...withoutTotals } = INPUT;

    await service.createInvoice({
      ...withoutTotals,
      items: [{ ...ITEM, subtotal: undefined }],
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 25, tax_amount: 0, total: 25 }),
      { transaction: TRANSACTION },
    );
    expect(repository.createItems).toHaveBeenCalledWith(
      [expect.objectContaining({ subtotal: 25 })],
      { transaction: TRANSACTION },
    );
  });

  it("uses an explicit due_date and defaults the notes to null", async () => {
    const { repository, service } = buildService();

    await service.createInvoice({
      ...INPUT,
      due_date: "2026-12-01",
      payment_term_days: 90,
      notes: undefined,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: "2026-12-01", notes: null }),
      { transaction: TRANSACTION },
    );
  });

  it("answers 422 when the order has no payment term", async () => {
    const { repository, service } = buildService();
    const { payment_term_id, ...withoutTerm } = INPUT;

    await expect(service.createInvoice(withoutTerm)).rejects.toMatchObject({
      status: 422,
      body: { errors: { payment_term_id: "Payment term is required" } },
    });
    expect(repository.findPaymentTermById).not.toHaveBeenCalled();
    expect(repository.nextNumber).not.toHaveBeenCalled();
  });

  it("answers 422 when the term does not exist or is inactive", async () => {
    const { service } = buildService(
      repositoryDouble({
        findPaymentTermById: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(service.createInvoice(INPUT)).rejects.toMatchObject({
      status: 422,
      body: { errors: { payment_term_id: "Invalid payment term" } },
    });

    const inactive = buildService(
      repositoryDouble({
        findPaymentTermById: jest
          .fn()
          .mockResolvedValue({ id: 3, days: 15, is_active: false }),
      }),
    );

    await expect(inactive.service.createInvoice(INPUT)).rejects.toMatchObject({
      status: 422,
      body: { errors: { payment_term_id: "Invalid payment term" } },
    });
  });

  it("calculates due_date with the stored term days", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findPaymentTermById: jest
          .fn()
          .mockResolvedValue({ id: 3, days: 30, is_active: true }),
      }),
    );

    await service.createInvoice({ ...INPUT, due_date: undefined });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_term_id: 3,
        due_date: "2026-12-01",
      }),
      { transaction: TRANSACTION },
    );
  });

  it("rolls back and does not reload when a line fails", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        createItems: jest.fn().mockRejectedValue(new Error("line failed")),
      }),
    );

    await expect(service.createInvoice(INPUT)).rejects.toThrow("line failed");
    expect(repository.findById).not.toHaveBeenCalled();
  });
});
