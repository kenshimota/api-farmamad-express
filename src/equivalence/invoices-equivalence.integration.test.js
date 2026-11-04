process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCustomer,
  createInvoice,
  createInvoiceItem,
  resetDatabase,
  sessionFor,
  unique,
} = require("../../test/helpers/invoices");
const { sessionFor: customerSessionFor } = require("../../test/helpers/orders");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
  await ensureBaseCurrency();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

/**
 * Ensures the seeded VES base currency exists after a suite truncated it.
 * @returns {Promise<object>} The base currency.
 */
async function ensureBaseCurrency() {
  const base = await Currency.findOne({ where: { is_base: true } });

  if (base) {
    return base.update({ is_active: true, rate: "1.000000" });
  }

  const ves = await Currency.findOne({ where: { code: "VES" } });

  if (ves) {
    return ves.update({ is_base: true, is_active: true, rate: "1.000000" });
  }

  return Currency.create({
    code: "VES",
    name: "Bolívar",
    symbol: "Bs",
    rate: "1.000000",
    is_base: true,
    is_active: true,
  });
}

describe("GET /invoices/:id/equivalence with a real database", () => {
  it("converts the invoice, paid amount and balance due", async () => {
    const admin = await sessionFor("admin");
    const customer = await createCustomer();
    const invoice = await createInvoice({
      customer_id: customer.id,
      invoiced_by_user_id: admin.user.id,
      order_id: 100,
      subtotal: 28.58,
      total: 28.58,
      paid_amount: 10,
      payment_status: "partial",
      payment_term_id: (await createTerm()).id,
    });
    await createInvoiceItem({
      invoice_id: invoice.id,
      quantity: 2,
      unit_price: 14.29,
      subtotal: 28.58,
    });

    const response = await as(
      "get",
      `/invoices/${invoice.id}/equivalence`,
      admin.token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource: "invoice",
      invoice: {
        id: invoice.id,
        number: invoice.number,
        order_id: 100,
        order_number: null,
        payment_status: "partial",
        issued_at: "2026-11-01T12:00:00.000Z",
        due_date: "2026-11-16",
      },
      payment_term: { code: "cash", days: 0 },
      source: {
        currency: { code: "USD_BCV", is_base: false },
        subtotal: 28.58,
        total: 28.58,
        paid_amount: 10,
        balance_due: 18.58,
      },
      target: { currency: { code: "VES", is_base: true } },
      exchange_rate: 889.89,
      payment: {
        is_cash: true,
        amount_due_source: 18.58,
        amount_due_target: 16534.16,
      },
    });
    expect(response.body.lines).toEqual([
      expect.objectContaining({
        product_name: expect.any(String),
        quantity: 2,
        unit_price_source: 14.29,
        subtotal_source: 28.58,
      }),
    ]);
  });

  it("returns rate 1 for the source currency and does not modify the invoice", async () => {
    const admin = await sessionFor("admin");
    const customer = await createCustomer();
    const invoice = await createInvoice({
      customer_id: customer.id,
      invoiced_by_user_id: admin.user.id,
    });
    const before = await as("get", `/invoices/${invoice.id}`, admin.token);

    const response = await as(
      "get",
      `/invoices/${invoice.id}/equivalence?currency_id=${invoice.currency_id}`,
      admin.token,
    );

    expect(response.status).toBe(200);
    expect(response.body.exchange_rate).toBe(1);
    expect(response.body.target.total).toBe(response.body.source.total);

    const after = await as("get", `/invoices/${invoice.id}`, admin.token);
    expect(after.body).toEqual(before.body);
  });

  it("hides another customer's invoice and rejects warehouse roles", async () => {
    const admin = await sessionFor("admin");
    const owner = await createCustomer();
    const invoice = await createInvoice({
      customer_id: owner.id,
      invoiced_by_user_id: admin.user.id,
    });
    const ownerSession = await customerSessionFor("customer", {
      username: `owner_${unique("U").toLowerCase()}`.slice(0, 50),
      email: `owner-${unique("E").toLowerCase()}@example.com`,
    });
    await ownerSession.user.update({ customer_id: owner.id });
    const otherCustomer = await createCustomer();
    const otherSession = await customerSessionFor("customer", {
      username: `other_${unique("U").toLowerCase()}`.slice(0, 50),
      email: `other-${unique("E").toLowerCase()}@example.com`,
    });
    await otherSession.user.update({ customer_id: otherCustomer.id });
    const support = await sessionFor("support");

    const own = await as(
      "get",
      `/invoices/${invoice.id}/equivalence`,
      ownerSession.token,
    );
    expect(own.status).toBe(200);

    const foreign = await as(
      "get",
      `/invoices/${invoice.id}/equivalence`,
      otherSession.token,
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ message: "Invoice not found" });

    const forbidden = await as(
      "get",
      `/invoices/${invoice.id}/equivalence`,
      support.token,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("validates the target currency", async () => {
    const admin = await sessionFor("admin");
    const customer = await createCustomer();
    const invoice = await createInvoice({
      customer_id: customer.id,
      invoiced_by_user_id: admin.user.id,
    });
    const inactive = await Currency.create({
      code: `I${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      name: "Test off",
      symbol: "T",
      rate: "2.000000",
      is_base: false,
      is_active: false,
    });
    const path = `/invoices/${invoice.id}/equivalence`;

    const missing = await as("get", `${path}?currency_id=99999`, admin.token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Currency not found" });

    const disabled = await as(
      "get",
      `${path}?currency_id=${inactive.id}`,
      admin.token,
    );
    expect(disabled.status).toBe(422);
    expect(disabled.body).toEqual({
      errors: { currency_id: "Invalid currency" },
    });
  });
});

/**
 * Resolves the cash term used by the invoice fixture.
 * @returns {Promise<object>} The cash payment term.
 */
function createTerm() {
  return require("../../test/helpers/payment-terms").ensurePaymentTerm("cash");
}
