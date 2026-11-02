const { calculateDueDate, calculateItemSubtotal } = require("./service");
const {
  INVOICE,
  NOW,
  buildService,
  repositoryDouble,
} = require("../../test/helpers/invoice-service-doubles");

describe("invoice date and amount helpers", () => {
  it("adds the payment term days to the issue date", () => {
    expect(calculateDueDate(NOW, 15)).toBe("2026-11-16");
    expect(calculateDueDate(NOW, 0)).toBe("2026-11-01");
    expect(calculateDueDate("2026-02-27T23:30:00.000Z", 2)).toBe("2026-03-01");
  });

  it("falls back to the issue date for invalid or missing days", () => {
    expect(calculateDueDate(NOW, undefined)).toBe("2026-11-01");
    expect(calculateDueDate(NOW, null)).toBe("2026-11-01");
    expect(calculateDueDate(NOW, -1)).toBe("2026-11-01");
  });

  it("rounds the line subtotal to two decimals", () => {
    expect(calculateItemSubtotal({ quantity: 2, unit_price: 12.5 })).toBe(25);
    expect(calculateItemSubtotal({ quantity: 3, unit_price: 0.1 })).toBe(0.3);
    expect(calculateItemSubtotal({ quantity: 0, unit_price: 10 })).toBe(0);
  });
});

describe("listInvoices", () => {
  it("delegates to the repository with the filters", async () => {
    const { repository, service } = buildService();
    const rows = [{ id: 1 }];
    repository.list.mockResolvedValue(rows);

    await expect(service.listInvoices({ paymentStatus: "paid" })).resolves.toBe(
      rows,
    );
    expect(repository.list).toHaveBeenCalledWith({ paymentStatus: "paid" });
  });
});

describe("getInvoice", () => {
  it.each(["admin", "seller"])(
    "lets a %s see any invoice with its internal user",
    async (role) => {
      const { repository, service } = buildService();

      await expect(service.getInvoice(1, { sub: 1, role })).resolves.toBe(
        INVOICE,
      );
      expect(repository.findById).toHaveBeenCalledWith(1, {
        includeItems: true,
        includeInvoicedBy: true,
      });
      expect(repository.findUserById).not.toHaveBeenCalled();
    },
  );

  it("lets a customer see an invoice of their own customer_id", async () => {
    const { repository, service } = buildService();

    await expect(
      service.getInvoice(1, { sub: 5, role: "customer" }),
    ).resolves.toBe(INVOICE);
    expect(repository.findUserById).toHaveBeenCalledWith(5, undefined);
    expect(repository.findById).toHaveBeenCalledWith(1, {
      includeItems: true,
      includeInvoicedBy: false,
    });
  });

  it("answers 403 when the customer has no linked customer_id", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findUserById: jest.fn().mockResolvedValue({ id: 5 }),
      }),
    );

    await expect(
      service.getInvoice(1, { sub: 5, role: "customer" }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: "Customer profile is not linked" },
    });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("answers 403 when the customer does not exist", async () => {
    const { service } = buildService(
      repositoryDouble({ findUserById: jest.fn().mockResolvedValue(null) }),
    );

    await expect(
      service.getInvoice(1, { sub: 5, role: "customer" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("answers 404 for another customer's invoice", async () => {
    const { service } = buildService(
      repositoryDouble({
        findUserById: jest.fn().mockResolvedValue({ id: 5, customer_id: 9 }),
      }),
    );

    await expect(
      service.getInvoice(1, { sub: 5, role: "customer" }),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Invoice not found" },
    });
  });

  it("answers 404 when the invoice does not exist", async () => {
    const { service } = buildService(
      repositoryDouble({ findById: jest.fn().mockResolvedValue(null) }),
    );

    await expect(
      service.getInvoice(99, { sub: 1, role: "admin" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each(["dispatcher", "support", "manager_warehouse"])(
    "answers 403 for the %s role",
    async (role) => {
      const { service } = buildService();

      await expect(
        service.getInvoice(1, { sub: 1, role }),
      ).rejects.toMatchObject({ status: 403, body: { message: "Forbidden" } });
    },
  );
});

describe("getInvoiceByOrder", () => {
  it("returns the invoice of the order for an admin", async () => {
    const { repository, service } = buildService();

    await expect(
      service.getInvoiceByOrder(10, { sub: 1, role: "admin" }),
    ).resolves.toBe(INVOICE);
    expect(repository.findByOrderId).toHaveBeenCalledWith(10, {
      includeItems: true,
      includeInvoicedBy: true,
    });
  });

  it("answers 404 when the order has no invoice", async () => {
    const { service } = buildService(
      repositoryDouble({ findByOrderId: jest.fn().mockResolvedValue(null) }),
    );

    await expect(
      service.getInvoiceByOrder(10, { sub: 1, role: "admin" }),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Invoice not found" },
    });
  });

  it("applies the customer ownership rule", async () => {
    const { service } = buildService();

    await expect(
      service.getInvoiceByOrder(10, { sub: 5, role: "customer" }),
    ).resolves.toBe(INVOICE);
  });
});
