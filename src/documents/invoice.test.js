const {
  buildInvoiceDocument,
  createInvoiceDocumentService,
} = require("./invoice");

const GENERATED_AT = new Date("2026-11-03T12:00:00.000Z");

const INVOICE = Object.freeze({
  id: 7,
  number: 7,
  order_id: 10,
  customer_id: 8,
  currency_id: 3,
  subtotal: "25.00",
  tax_amount: "1.00",
  total: "26.00",
  paid_amount: "10.00",
  payment_status: "partial",
  issued_at: new Date("2026-11-01T12:00:00.000Z"),
  due_date: "2026-11-16",
  notes: "Pagar antes del vencimiento",
  customer: {
    id: 8,
    fullName: "Cliente Demo",
    email: "cliente@example.com",
    direction: "Calle 1",
  },
  currency: {
    id: 3,
    code: "USD_BCV",
    name: "Dólar BCV",
    symbol: "$",
    rate: "889.890000",
  },
  payment_term: { id: 1, code: "cash", name: "Contado", days: 0 },
  items: [
    {
      product_name: "Ibuprofeno",
      product_reference: "REF-1",
      item_state_name: "Vendible",
      quantity: 2,
      unit_price: "12.50",
      subtotal: "25.00",
    },
  ],
  payment_allocations: [],
});

const PAYMENTS = [
  {
    id: 1,
    payment_id: 9,
    amount: "10.00",
    applied_amount: "10.00",
    exchange_rate: "1.000000",
    allocated_at: new Date("2026-11-02T09:00:00.000Z"),
    payment: {
      id: 9,
      currency_id: 3,
      currency: {
        id: 3,
        code: "USD_BCV",
        name: "Dólar BCV",
        symbol: "$",
      },
      method_payment: { id: 2, label: "Binance Farmamed" },
    },
  },
];

/**
 * Builds the service with fakes.
 * @param {object} [invoice] - Invoice returned by the invoice service.
 * @returns {object} The fakes and the service.
 */
function buildService(invoice = INVOICE) {
  const invoiceService = {
    getInvoice: jest.fn().mockResolvedValue(invoice),
  };
  const invoicePaymentService = {
    listInvoicePayments: jest.fn().mockResolvedValue(PAYMENTS),
  };
  const repository = {
    findOrderNumber: jest.fn().mockResolvedValue({ id: 10, number: 10 }),
  };
  const service = createInvoiceDocumentService({
    invoiceService,
    invoicePaymentService,
    repository,
    clock: () => GENERATED_AT,
  });

  return { service, invoiceService, invoicePaymentService, repository };
}

describe("invoice document service", () => {
  it("builds the immutable invoice data without conversion", async () => {
    const { service, repository } = buildService();

    const data = await service.getInvoiceDocument(7, {
      sub: 1,
      role: "admin",
    });

    expect(data).toMatchObject({
      generated_at: GENERATED_AT.toISOString(),
      order_number: 10,
      invoice: {
        id: 7,
        number: 7,
        payment_status: "partial",
        subtotal: 25,
        tax_amount: 1,
        total: 26,
        paid_amount: 10,
        balance_due: 16,
        issued_at: "2026-11-01T12:00:00.000Z",
        due_date: "2026-11-16",
      },
      currency: { id: 3, code: "USD_BCV", symbol: "$" },
      payment_term: { name: "Contado", days: 0 },
    });
    expect(data.items).toEqual([
      {
        product_name: "Ibuprofeno",
        product_reference: "REF-1",
        item_state_name: "Vendible",
        quantity: 2,
        unit_price: 12.5,
        subtotal: 25,
      },
    ]);
    expect(data.payments).toEqual([
      {
        allocated_at: "2026-11-02T09:00:00.000Z",
        amount: 10,
        currency: { code: "USD_BCV", symbol: "$", name: "Dólar BCV" },
        applied_amount: 10,
        method: "Binance Farmamed",
      },
    ]);
    expect(repository.findOrderNumber).toHaveBeenCalledWith(10);
  });

  it("omits the order number and the payment history when absent", async () => {
    const invoice = { ...INVOICE, order_id: null, payment_status: "pending" };
    const repository = { findOrderNumber: jest.fn() };
    const service = createInvoiceDocumentService({
      invoiceService: { getInvoice: jest.fn().mockResolvedValue(invoice) },
      invoicePaymentService: {
        listInvoicePayments: jest.fn().mockResolvedValue([]),
      },
      repository,
      clock: () => GENERATED_AT,
    });

    const data = await service.getInvoiceDocument(7, {
      sub: 1,
      role: "customer",
    });

    expect(data.order_number).toBeNull();
    expect(data.payments).toEqual([]);
    expect(repository.findOrderNumber).not.toHaveBeenCalled();
  });

  it("handles missing relations, raw dates and empty payment details", () => {
    const data = buildInvoiceDocument({
      invoice: {
        id: 7,
        number: 7,
        subtotal: "0.00",
        tax_amount: "0.00",
        total: "0.00",
        paid_amount: "0.00",
        payment_status: "pending",
        issued_at: "2026-11-01T12:00:00.000Z",
        due_date: new Date("2026-11-16T00:00:00.000Z"),
        notes: null,
        customer: null,
        currency: null,
        payment_term: null,
        items: null,
      },
      payments: [
        {
          amount: "1.00",
          applied_amount: "1.00",
          allocated_at: "2026-11-02T09:00:00.000Z",
          payment: null,
        },
      ],
      order: null,
      generatedAt: GENERATED_AT,
    });

    expect(data).toMatchObject({
      order_number: null,
      customer: null,
      payment_term: null,
      currency: null,
      items: [],
      invoice: { due_date: "2026-11-16", balance_due: 0 },
    });
    expect(data.payments[0]).toEqual({
      allocated_at: "2026-11-02T09:00:00.000Z",
      amount: 1,
      currency: null,
      applied_amount: 1,
      method: null,
    });
  });
});
