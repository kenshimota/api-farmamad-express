process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { UniqueConstraintError } = require("sequelize");
const sequelize = require("../database");
const Invoice = require("../models/invoice");
const PaymentAllocation = require("../models/payment-allocation");
const WalletTransaction = require("../models/wallet-transaction");
const CustomerWallet = require("../models/customer-wallet");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { as, createPayment, tokenFor } = require("../../test/helpers/payments");
const {
  buildInvoicePaymentFixture,
  resetDatabase,
} = require("../../test/helpers/invoice-payments");

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

/**
 * Applies a payment through the API.
 * @param {object} fixture - Invoice payment fixture.
 * @param {number} paymentId - Payment id.
 * @param {number} amount - Amount to apply.
 * @param {string} [token] - Token to use.
 * @returns {Promise<import("supertest").Response>} The response.
 */
function applyPayment(fixture, paymentId, amount, token = fixture.adminToken) {
  return as("post", `/invoices/${fixture.invoice.id}/payments`, token).send({
    payment_id: paymentId,
    amount,
  });
}

/**
 * Builds an invoice with two applied payments and returns the fixture.
 * @returns {Promise<object>} The fixture with both responses.
 */
async function buildPaidFixture() {
  const fixture = await buildInvoicePaymentFixture({
    deposit: 100,
    total: 25,
  });
  const first = await applyPayment(fixture, fixture.paymentId, 10);
  const secondPayment = await createPayment(fixture, { amount: 50 });
  const second = await applyPayment(fixture, secondPayment.body.id, 2.5);

  return { ...fixture, first, second, secondPayment };
}

describe("GET /invoices/:id/payments with a real database", () => {
  it("returns the history ordered by allocation with method and user", async () => {
    const fixture = await buildPaidFixture();

    const response = await as(
      "get",
      `/invoices/${fixture.invoice.id}/payments`,
      fixture.sellerToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.map((row) => row.payment_id)).toEqual([
      fixture.paymentId,
      fixture.secondPayment.body.id,
    ]);
    expect(response.body[0]).toMatchObject({
      id: fixture.first.body.id,
      payment_id: fixture.paymentId,
      amount: 10,
      applied_amount: 20,
      exchange_rate: 2,
      allocated_at: expect.any(String),
      currency: {
        id: fixture.currency.id,
        code: fixture.currency.code,
        name: fixture.currency.name,
        symbol: fixture.currency.symbol,
      },
      method_payment: {
        id: fixture.method.id,
        label: fixture.method.label,
      },
      method_payment_type: {
        id: fixture.type.id,
        code: fixture.type.code,
        name: fixture.type.name,
      },
      created_by: {
        id: fixture.admin.user.id,
        username: fixture.admin.user.username,
        email: fixture.admin.user.email,
      },
    });
  });

  it("hides created_by from the owning customer", async () => {
    const fixture = await buildPaidFixture();

    const response = await as(
      "get",
      `/invoices/${fixture.invoice.id}/payments`,
      fixture.customerToken,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).not.toHaveProperty("created_by");
  });

  it("hides another customer's invoice behind a 404", async () => {
    const fixture = await buildPaidFixture();

    const response = await as(
      "get",
      `/invoices/${fixture.invoice.id}/payments`,
      fixture.otherToken,
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Invoice not found" });
  });

  it("answers 403 for a customer without users.customer_id", async () => {
    const fixture = await buildPaidFixture();
    const { token } = await tokenFor("customer");

    const response = await as(
      "get",
      `/invoices/${fixture.invoice.id}/payments`,
      token,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer profile is not linked",
    });
  });

  it.each(["dispatcher", "manager_warehouse", "support"])(
    "answers 403 for a %s",
    async (role) => {
      const fixture = await buildPaidFixture();
      const { token } = await tokenFor(role);

      const response = await as(
        "get",
        `/invoices/${fixture.invoice.id}/payments`,
        token,
      );

      expect(response.status).toBe(403);
    },
  );

  it("answers 422 for an invalid id and 404 for a missing invoice", async () => {
    const fixture = await buildPaidFixture();
    const invalid = await as(
      "get",
      "/invoices/abc/payments",
      fixture.sellerToken,
    );
    const missing = await as(
      "get",
      "/invoices/999999/payments",
      fixture.sellerToken,
    );

    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({ errors: { id: "Invalid invoice id" } });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Invoice not found" });
  });
});

describe("invoice detail and filters with payments", () => {
  it("adds paid_amount, status, count and the summarized history", async () => {
    const fixture = await buildPaidFixture();

    const detail = await as(
      "get",
      `/invoices/${fixture.invoice.id}`,
      fixture.adminToken,
    );

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id: fixture.invoice.id,
      total: 25,
      paid_amount: 25,
      balance_due: 0,
      payment_status: "paid",
      payments_count: 2,
      payment_history: [
        {
          payment_id: fixture.paymentId,
          amount: 10,
          applied_amount: 20,
          currency: expect.objectContaining({ id: fixture.currency.id }),
          allocated_at: expect.any(String),
        },
        {
          payment_id: fixture.secondPayment.body.id,
          amount: 2.5,
          applied_amount: 5,
          currency: expect.objectContaining({ id: fixture.currency.id }),
          allocated_at: expect.any(String),
        },
      ],
    });
    expect(detail.body.payment_history[0]).not.toHaveProperty("created_by");
    expect(JSON.stringify(detail.body)).not.toContain("balance_after");
  });

  it("filters the listing by payment_status", async () => {
    const fixture = await buildPaidFixture();

    const paid = await as(
      "get",
      "/invoices?payment_status=paid",
      fixture.adminToken,
    );
    const pending = await as(
      "get",
      "/invoices?payment_status=pending",
      fixture.adminToken,
    );

    expect(paid.status).toBe(200);
    expect(paid.body.map((row) => row.id)).toEqual([fixture.invoice.id]);
    expect(pending.body).toEqual([]);
  });
});
