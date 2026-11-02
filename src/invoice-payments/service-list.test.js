const {
  buildService,
  repositoryDouble,
} = require("../../test/helpers/invoice-payments-doubles");

describe("listInvoicePayments", () => {
  it.each(["admin", "seller"])(
    "lets a %s read any invoice including created_by",
    async (role) => {
      const rows = [{ id: 11 }];
      const { repository, service } = buildService(
        repositoryDouble({
          listAllocations: jest.fn().mockResolvedValue(rows),
        }),
      );

      await expect(
        service.listInvoicePayments(1, { sub: 1, role }),
      ).resolves.toBe(rows);
      expect(repository.listAllocations).toHaveBeenCalledWith(1, {
        includeCreatedBy: true,
      });
      expect(repository.findUserById).not.toHaveBeenCalled();
    },
  );

  it("lets a customer read a own invoice without created_by", async () => {
    const rows = [{ id: 11 }];
    const { repository, service } = buildService(
      repositoryDouble({
        listAllocations: jest.fn().mockResolvedValue(rows),
      }),
    );

    await expect(
      service.listInvoicePayments(1, { sub: 5, role: "customer" }),
    ).resolves.toBe(rows);
    expect(repository.findUserById).toHaveBeenCalledWith(5, undefined);
    expect(repository.listAllocations).toHaveBeenCalledWith(1, {
      includeCreatedBy: false,
    });
  });

  it("answers 403 when the customer profile is not linked", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findUserById: jest.fn().mockResolvedValue({ id: 5 }),
      }),
    );

    await expect(
      service.listInvoicePayments(1, { sub: 5, role: "customer" }),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: "Customer profile is not linked" },
    });
    expect(repository.listAllocations).not.toHaveBeenCalled();
  });

  it("hides another customer's invoice behind a 404", async () => {
    const { repository, service } = buildService(
      repositoryDouble({
        findUserById: jest.fn().mockResolvedValue({ id: 5, customer_id: 9 }),
      }),
    );

    await expect(
      service.listInvoicePayments(1, { sub: 5, role: "customer" }),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Invoice not found" },
    });
    expect(repository.listAllocations).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "answers 403 for the %s role",
    async (role) => {
      const { service } = buildService();

      await expect(
        service.listInvoicePayments(1, { sub: 1, role }),
      ).rejects.toMatchObject({
        status: 403,
        body: { message: "Forbidden" },
      });
    },
  );

  it("answers 404 when the invoice does not exist", async () => {
    const { service } = buildService(
      repositoryDouble({
        findInvoiceById: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      service.listInvoicePayments(99, { sub: 1, role: "admin" }),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Invoice not found" },
    });
  });
});
