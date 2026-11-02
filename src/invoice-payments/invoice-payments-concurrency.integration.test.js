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

describe("concurrent allocations", () => {
  it("never overpays the invoice nor leaves a negative wallet", async () => {
    const fixture = await buildInvoicePaymentFixture({
      deposit: 900,
      total: 100,
      invoiceRate: "900.000000",
    });
    const secondPayment = await createPayment(fixture, { amount: 100 });

    const responses = await Promise.all([
      applyPayment(fixture, fixture.paymentId, 80),
      applyPayment(fixture, secondPayment.body.id, 80),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 422]);
    expect(await PaymentAllocation.count()).toBe(1);

    const invoice = await Invoice.findByPk(fixture.invoice.id);
    expect(invoice.paid_amount).toBe("80.00");
    expect(invoice.payment_status).toBe("partial");

    const wallet = await CustomerWallet.findOne({
      where: { customer_id: fixture.customer.id },
    });
    expect(Number(wallet.balance)).toBeGreaterThanOrEqual(0);
    expect(wallet.balance).toBe("920.00");

    const errors = responses.find((response) => response.status === 422);
    expect(errors.body).toEqual({
      errors: { amount: "Amount exceeds invoice balance" },
    });
  });

  it("allows two allocations that together fit the invoice balance", async () => {
    const fixture = await buildInvoicePaymentFixture({
      deposit: 1000,
      total: 100,
      invoiceRate: "900.000000",
    });
    const secondPayment = await createPayment(fixture, { amount: 100 });

    const responses = await Promise.all([
      applyPayment(fixture, fixture.paymentId, 50),
      applyPayment(fixture, secondPayment.body.id, 50),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await PaymentAllocation.count()).toBe(2);
    const invoice = await Invoice.findByPk(fixture.invoice.id);
    expect(invoice.paid_amount).toBe("100.00");
    expect(invoice.payment_status).toBe("paid");
  });
});

describe("invoice payment database invariants", () => {
  it("keeps paid_amount within total", async () => {
    const fixture = await buildInvoicePaymentFixture();

    await expect(fixture.invoice.update({ paid_amount: 30 })).rejects.toThrow(
      /invoices_paid_amount_within_total/,
    );
  });

  it("allows at most one wallet movement per allocation", async () => {
    const fixture = await buildInvoicePaymentFixture();
    const response = await applyPayment(fixture, fixture.paymentId, 10);
    const allocation = await PaymentAllocation.findByPk(response.body.id);
    const wallet = await CustomerWallet.findOne({
      where: { customer_id: fixture.customer.id },
    });

    await expect(
      WalletTransaction.create({
        wallet_id: wallet.id,
        transaction_type: "invoice_payment",
        amount: -1,
        balance_after: 99,
        payment_id: fixture.paymentId,
        invoice_id: fixture.invoice.id,
        payment_allocation_id: allocation.id,
        created_by_user_id: fixture.admin.user.id,
      }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
  });
});
