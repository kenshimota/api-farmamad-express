const { renderInvoicePdf, renderQuotationPdf } = require("./pdf");

const COMPANY = Object.freeze({
  name: "Farmamed",
  taxId: "J-12345678-9",
  address: "Av. Monseñor Rivero 123",
  phone: "+58 212 555-1234",
  email: "hola@farmamed.com",
  logo: null,
});

/**
 * Builds a quotation document.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The document data.
 */
function quotation(overrides = {}) {
  return {
    order: { id: 10, number: 10, status: "generate" },
    issued_at: "2026-11-03T12:00:00.000Z",
    customer: {
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Calle 1",
    },
    delivery_address: "Av. Monseñor Rivero 123",
    notes: "Entregar por la tarde",
    payment_term: { name: "Contado", days: 0 },
    source_currency: {
      id: 3,
      code: "USD_BCV",
      name: "Dólar BCV",
      symbol: "$",
      rate: 889.89,
    },
    target_currency: {
      id: 1,
      code: "VES",
      name: "Bolívar",
      symbol: "Bs",
      rate: 1,
    },
    is_conversion: true,
    exchange_rate: 889.89,
    source_rate_changed_at: "2026-11-01T10:00:00.000Z",
    target_rate_changed_at: "2026-10-30T08:00:00.000Z",
    subtotal_source: 120,
    total_source: 120,
    subtotal_target: 106786.8,
    total_target: 106786.8,
    rounding_adjustment: 0,
    items: [
      {
        product_name: "Ibuprofeno",
        product_reference: "REF-1",
        item_state_name: "Vendible",
        quantity: 2,
        unit_price_source: 60,
        subtotal_source: 120,
        unit_price_target: 53393.4,
        subtotal_target: 106786.8,
      },
    ],
    ...overrides,
  };
}

/**
 * Builds an invoice document.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {object} The document data.
 */
function invoice(overrides = {}) {
  return {
    generated_at: "2026-11-03T12:00:00.000Z",
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
      notes: "Pagar antes del vencimiento",
    },
    customer: {
      fullName: "Cliente Demo",
      email: "cliente@example.com",
      direction: "Calle 1",
    },
    payment_term: { name: "Contado", days: 0 },
    currency: {
      id: 3,
      code: "USD_BCV",
      name: "Dólar BCV",
      symbol: "$",
      rate: 889.89,
    },
    items: [
      {
        product_name: "Ibuprofeno",
        product_reference: "REF-1",
        item_state_name: "Vendible",
        quantity: 2,
        unit_price: 12.5,
        subtotal: 25,
      },
    ],
    payments: [
      {
        allocated_at: "2026-11-02T09:00:00.000Z",
        amount: 10,
        currency: { code: "USD_BCV", name: "Dólar BCV", symbol: "$" },
        applied_amount: 10,
        method: "Binance Farmamed",
      },
    ],
    ...overrides,
  };
}

describe("PDF document generation", () => {
  it("renders a convertible quotation as a real PDF buffer", async () => {
    const buffer = await renderQuotationPdf(quotation(), COMPANY);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders a same-currency quotation and a long note", async () => {
    const buffer = await renderQuotationPdf(
      quotation({
        is_conversion: false,
        target_currency: quotation().source_currency,
        exchange_rate: 1,
        notes: "áéíóú ñ ü € ".repeat(100),
      }),
      COMPANY,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders an invoice with payment history and unsupported characters", async () => {
    const buffer = await renderInvoicePdf(
      invoice({
        customer: {
          fullName: "Cliente “especial” 😀",
          email: "cliente@example.com",
          direction: "Calle 1",
        },
      }),
      COMPANY,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders an invoice without payments or notes", async () => {
    const data = invoice({ payments: [], order_number: null });
    data.invoice.notes = null;

    const buffer = await renderInvoicePdf(data, COMPANY);

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a company logo and skips an invalid one", async () => {
    const logo = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    );

    const withLogo = await renderQuotationPdf(quotation(), {
      ...COMPANY,
      logo,
    });
    expect(withLogo.subarray(0, 5).toString()).toBe("%PDF-");

    const invalid = await renderQuotationPdf(quotation(), {
      ...COMPANY,
      phone: null,
      email: null,
      logo: Buffer.from("not-an-image"),
    });
    expect(invalid.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("paginates long tables and numbers every page", async () => {
    const items = Array.from({ length: 60 }, (_, index) => ({
      product_name: `Producto ${index}`,
      product_reference: `REF-${index}`,
      item_state_name: "Vendible",
      quantity: 1,
      unit_price_source: 1,
      subtotal_source: 1,
      unit_price_target: 1,
      subtotal_target: 1,
    }));
    const buffer = await renderQuotationPdf(
      quotation({ items, subtotal_target: 60, total_target: 60 }),
      COMPANY,
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(3000);
  });
});
