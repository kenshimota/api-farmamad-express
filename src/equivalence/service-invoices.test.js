const {
  buildService,
  invoiceFixture,
} = require("../../test/helpers/equivalence");
const { createEquivalenceService } = require("./service");

describe("invoice equivalence", () => {
  it("converts the invoice header including paid amount and balance due", async () => {
    const { service, repository } = buildService({
      invoice: invoiceFixture(),
    });

    const result = await service.getInvoiceEquivalence(7, { role: "admin" });

    expect(repository.findOrderNumber).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      resource: "invoice",
      invoice: {
        id: 7,
        number: 7,
        order_id: 10,
        order_number: 10,
        payment_status: "partial",
        issued_at: "2026-11-02T15:00:00.000Z",
        due_date: "2026-11-02",
      },
      source: {
        subtotal: 85,
        tax_amount: 0,
        total: 85,
        paid_amount: 10,
        balance_due: 75,
      },
      target: {
        subtotal: 75640.65,
        tax_amount: 0,
        total: 75640.65,
        paid_amount: 8898.9,
        balance_due: 66741.75,
      },
      exchange_rate: 889.89,
      payment: {
        is_cash: true,
        amount_due_source: 75,
        amount_due_target: 66741.75,
      },
    });
    expect(result.lines).toEqual([
      {
        order_item_id: 20,
        product_id: 15,
        product_name: "Producto demo",
        product_reference: "REF-015",
        item_state_id: 1,
        item_state_name: "Vendible",
        quantity: 10,
        unit_price_source: 8.5,
        subtotal_source: 85,
        unit_price_target: 7564.06,
        subtotal_target: 75640.6,
      },
    ]);
  });

  it("uses the invoice total minus paid as the amount due", async () => {
    const { service } = buildService({
      invoice: invoiceFixture({
        total: "100.00",
        paid_amount: "40.00",
        subtotal: "100.00",
      }),
    });

    const result = await service.getInvoiceEquivalence(7, { role: "admin" }, 3);

    expect(result.source.balance_due).toBe(60);
    expect(result.payment.amount_due_source).toBe(60);
    expect(result.payment.amount_due_target).toBe(60);
  });

  it("returns order_number null when the invoice has no order", async () => {
    const { service, repository } = buildService({
      invoice: invoiceFixture({ order_id: null }),
    });

    const result = await service.getInvoiceEquivalence(7, { role: "admin" });

    expect(result.invoice.order_number).toBeNull();
    expect(repository.findOrderNumber).not.toHaveBeenCalled();
  });

  it("propagates the access error from the invoice service", async () => {
    const { service, invoices } = buildService({ invoice: invoiceFixture() });

    invoices.getInvoice.mockRejectedValue({
      status: 404,
      body: { message: "Invoice not found" },
    });

    await expect(
      service.getInvoiceEquivalence(99, { role: "customer" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("sorts the lines and uses the server clock by default", async () => {
    const { repository, orders, invoices } = buildService({
      invoice: invoiceFixture({
        items: [
          {
            order_item_id: 40,
            product_id: 16,
            product_name: "Segundo",
            product_reference: "REF-40",
            item_state_id: 1,
            item_state_name: "Vendible",
            quantity: 1,
            unit_price: "2.00",
            subtotal: "2.00",
          },
          {
            order_item_id: 20,
            product_id: 15,
            product_name: "Primero",
            product_reference: "REF-20",
            item_state_id: 1,
            item_state_name: "Vendible",
            quantity: 1,
            unit_price: "1.00",
            subtotal: "1.00",
          },
        ],
      }),
    });
    const service = createEquivalenceService({ repository, orders, invoices });

    const result = await service.getInvoiceEquivalence(7, { role: "admin" });

    expect(result.lines.map((line) => line.order_item_id)).toEqual([20, 40]);
    expect(result.calculated_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.calculated_at))).toBe(false);
  });
});
