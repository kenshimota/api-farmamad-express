process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const sequelize = require("../database");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { invoiceService } = require("./service");
const {
  Invoice,
  InvoiceItem,
  createCustomer,
  createInvoice,
  createInvoiceItem,
  createItemState,
  createProduct,
  createUser,
  nextInvoiceNumber,
  resetDatabase,
} = require("../../test/helpers/invoices");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

describe("invoice issuance service against a real database", () => {
  /**
   * Builds a valid issuance payload from real catalog rows.
   * @returns {Promise<object>} The service payload.
   */
  async function issuancePayload() {
    const user = await createUser("admin");
    const customer = await createCustomer();
    const product = await createProduct();
    const itemState = await createItemState();
    const currency = await Currency.findOne({ where: { code: "USD_BCV" } });

    return {
      order_id: 500,
      customer_id: customer.id,
      invoiced_by_user_id: user.id,
      currency_id: currency.id,
      payment_term_id: null,
      payment_term_days: 15,
      issued_at: "2026-11-01T12:00:00.000Z",
      notes: "Factura del pedido 500",
      items: [
        {
          order_item_id: null,
          product_id: product.id,
          product_name: product.name,
          product_reference: product.reference,
          item_state_id: itemState.id,
          item_state_name: itemState.name,
          quantity: 2,
          unit_price: 12.5,
        },
      ],
    };
  }

  it("creates the header, snapshots and due date atomically", async () => {
    const payload = await issuancePayload();

    const invoice = await invoiceService.createInvoice(payload);

    expect(invoice.number).toBe(1);
    expect(invoice.payment_status).toBe("pending");
    expect(invoice.paid_amount).toBe("0.00");
    expect(invoice.tax_amount).toBe("0.00");
    expect(invoice.total).toBe("25.00");
    expect(invoice.due_date).toBe("2026-11-16");
    expect(invoice.items).toHaveLength(1);
    expect(invoice.items[0]).toMatchObject({
      product_name: payload.items[0].product_name,
      product_reference: payload.items[0].product_reference,
      item_state_name: payload.items[0].item_state_name,
      subtotal: "25.00",
    });
  });

  it("answers 409 when the order already has an invoice", async () => {
    const payload = await issuancePayload();
    await invoiceService.createInvoice(payload);

    await expect(invoiceService.createInvoice(payload)).rejects.toMatchObject({
      status: 409,
      body: { message: "Order already has an invoice" },
    });
  });

  it("rolls the header back when a line cannot be inserted", async () => {
    const payload = await issuancePayload();
    payload.items[0].product_id = 999999;

    await expect(invoiceService.createInvoice(payload)).rejects.toThrow();
    await expect(
      Invoice.findOne({ where: { order_id: payload.order_id } }),
    ).resolves.toBeNull();
    await expect(InvoiceItem.count()).resolves.toBe(0);
  });
});

describe("invoice database invariants", () => {
  it("enforces one invoice per order and one line per order item", async () => {
    const first = await createInvoice({ order_id: 700 });
    const second = await createInvoiceItem({
      invoice_id: first.id,
      order_item_id: 20,
    });

    await expect(createInvoice({ order_id: 700 })).rejects.toBeInstanceOf(
      UniqueConstraintError,
    );
    await expect(
      createInvoiceItem({
        invoice_id: first.id,
        order_item_id: second.order_item_id,
        product_id: second.product_id,
        item_state_id: second.item_state_id,
      }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
  });

  it("enforces the customer, product and item state foreign keys", async () => {
    await expect(createInvoice({ customer_id: 999999 })).rejects.toBeInstanceOf(
      ForeignKeyConstraintError,
    );

    const invoice = await createInvoice();
    await expect(
      createInvoiceItem({ invoice_id: invoice.id, product_id: 999999 }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await expect(
      createInvoiceItem({ invoice_id: invoice.id, item_state_id: 999999 }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });

  it("assigns ascending, unique numbers from the sequence", async () => {
    const first = await nextInvoiceNumber();
    const second = await nextInvoiceNumber();

    expect(second).toBe(first + 1);
  });
});
