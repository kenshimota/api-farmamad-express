process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";
process.env.COMPANY_TAX_ID = "J-12345678-9";
process.env.COMPANY_ADDRESS = "Av. Monseñor Rivero 123";

const sequelize = require("../database");
const Currency = require("../models/currency");
const Invoice = require("../models/invoice");
const InvoiceItem = require("../models/invoice-item");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createOrderFixture } = require("../../test/helpers/order-lifecycle");
const { linkedCustomerSession } = require("../../test/helpers/orders");
const { as, resetDatabase, sessionFor } = require("../../test/helpers/orders");

const DOCUMENT_HEADERS = Object.freeze([
  "content-type",
  "content-disposition",
  "cache-control",
  "x-content-type-options",
]);

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

/**
 * Removes the invoices and restarts their numbering before each test.
 * @returns {Promise<void>}
 */
async function resetInvoices() {
  await InvoiceItem.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await Invoice.destroy({
    where: {},
    truncate: true,
    cascade: true,
    restartIdentity: true,
  });
  await sequelize.query("ALTER SEQUENCE invoices_number_seq RESTART WITH 1");
}

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetInvoices();
  await resetDatabase();
});

afterAll(async () => {
  await resetInvoices();
  await resetDatabase();
  await sequelize.close();
});

/**
 * Ensures the base currency exists, recreating VES when a previous suite
 * truncated the currencies table.
 * @returns {Promise<object>} The base currency.
 */
async function ensureBaseCurrency() {
  const base = await Currency.findOne({ where: { is_base: true } });

  if (base) {
    return base;
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

/**
 * Creates a draft order through the API.
 * @param {object} fixture - Sale fixture.
 * @returns {Promise<object>} The created order.
 */
async function createOrder(fixture) {
  const response = await as("post", "/orders", fixture.token).send({
    items: [
      {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
        quantity: 2,
      },
    ],
  });

  return response.body;
}

/**
 * Moves an order to the requested status.
 * @param {number} orderId - Order id.
 * @param {string} status - Destination status.
 * @param {string} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function transition(orderId, status, token) {
  return as("put", `/orders/${orderId}/status`, token).send({ status });
}

/**
 * Asserts the PDF response headers.
 * @param {import("supertest").Response} response - HTTP response.
 * @param {string} disposition - Expected Content-Disposition.
 * @returns {void}
 */
function expectPdf(response, disposition) {
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toContain("application/pdf");
  expect(response.headers["content-disposition"]).toBe(disposition);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
  expect(Buffer.from(response.body).subarray(0, 5).toString()).toBe("%PDF-");
}

describe("GET /orders/:id/quotation with a real database", () => {
  it("returns the quotation in the order currency for the owner", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const order = await createOrder(fixture);

    const response = await as(
      "get",
      `/orders/${order.id}/quotation`,
      fixture.token,
    );

    expectPdf(
      response,
      `inline; filename="cotizacion-pedido-${order.number}-USD_BCV.pdf"`,
    );
  });

  it("converts the quotation to VES without changing the order", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const order = await createOrder(fixture);
    const ves = await ensureBaseCurrency();

    const response = await as(
      "get",
      `/orders/${order.id}/quotation?currency_id=${ves.id}&download=true`,
      fixture.token,
    );

    expectPdf(
      response,
      `attachment; filename="cotizacion-pedido-${order.number}-${ves.code}.pdf"`,
    );

    const stored = await as("get", `/orders/${order.id}`, fixture.token);
    expect(stored.body.currency_id).toBe(fixture.cost.currency_id);
  });

  it("answers 409 for an invoiced order and 422 for invalid input", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const order = await createOrder(fixture);

    await transition(order.id, "generate", admin.token);
    await transition(order.id, "invoiced", admin.token);

    const invoiced = await as(
      "get",
      `/orders/${order.id}/quotation`,
      fixture.token,
    );
    expect(invoiced.status).toBe(409);
    expect(invoiced.body).toEqual({ message: "Order is already invoiced" });

    const cancelled = await as(
      "get",
      `/orders/${order.id}/quotation?download=maybe`,
      fixture.token,
    );
    expect(cancelled.status).toBe(422);
    expect(cancelled.body).toEqual({
      errors: { download: "Invalid download" },
    });
  });

  it("answers 409 for a cancelled order", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const order = await createOrder(fixture);

    await transition(order.id, "cancelled", fixture.token);

    const response = await as(
      "get",
      `/orders/${order.id}/quotation`,
      fixture.token,
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Order is cancelled" });
  });

  it("hides another customer's order and rejects warehouse roles", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const other = await linkedCustomerSession();
    const order = await createOrder(fixture);

    const foreign = await as(
      "get",
      `/orders/${order.id}/quotation`,
      other.token,
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ message: "Order not found" });

    for (const role of ["manager_warehouse", "dispatcher", "support"]) {
      const session = await sessionFor(role);
      const response = await as(
        "get",
        `/orders/${order.id}/quotation`,
        session.token,
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    }
  });
});

describe("GET /invoices/:id/pdf with a real database", () => {
  it("returns the invoice PDF to the owner and to staff", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const order = await createOrder(fixture);

    await transition(order.id, "generate", admin.token);
    await transition(order.id, "invoiced", admin.token);

    const invoice = await Invoice.findOne({ where: { order_id: order.id } });

    for (const token of [fixture.token, admin.token]) {
      const response = await as(
        "get",
        `/invoices/${invoice.id}/pdf?download=true`,
        token,
      );

      expectPdf(
        response,
        `attachment; filename="factura-${invoice.number}.pdf"`,
      );
      expect(response.headers[DOCUMENT_HEADERS[0]]).toContain(
        "application/pdf",
      );
    }
  });

  it("hides another customer's invoice and rejects invalid input", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const other = await linkedCustomerSession();
    const order = await createOrder(fixture);

    await transition(order.id, "generate", admin.token);
    await transition(order.id, "invoiced", admin.token);
    const invoice = await Invoice.findOne({ where: { order_id: order.id } });

    const foreign = await as("get", `/invoices/${invoice.id}/pdf`, other.token);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ message: "Invoice not found" });

    const invalid = await as("get", "/invoices/abc/pdf", admin.token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid invoice id" } });

    for (const role of ["manager_warehouse", "dispatcher", "support"]) {
      const session = await sessionFor(role);
      const response = await as(
        "get",
        `/invoices/${invoice.id}/pdf`,
        session.token,
      );

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    }
  });
});
