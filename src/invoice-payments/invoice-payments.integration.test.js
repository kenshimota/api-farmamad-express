process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const PaymentAllocation = require("../models/payment-allocation");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { as, tokenFor } = require("../../test/helpers/payments");
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
 * Applies a payment through the API as the seller.
 * @param {object} fixture - Invoice payment fixture.
 * @param {object} [body] - Request body overrides.
 * @param {string} [token] - Token to use.
 * @returns {Promise<import("supertest").Response>} The response.
 */
function applyPayment(fixture, body = {}, token = fixture.adminToken) {
  return as("post", `/invoices/${fixture.invoice.id}/payments`, token).send({
    payment_id: fixture.paymentId,
    amount: 10,
    ...body,
  });
}

describe("POST /invoices/:id/payments with a real database", () => {
  it("applies the payment, debits the wallet and updates the invoice atomically", async () => {
    const fixture = await buildInvoicePaymentFixture({
      deposit: 100,
      total: 25,
    });

    const response = await applyPayment(fixture);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      payment_id: fixture.paymentId,
      invoice_id: fixture.invoice.id,
      amount: 10,
      currency: {
        id: fixture.currency.id,
        code: fixture.currency.code,
        name: fixture.currency.name,
        symbol: fixture.currency.symbol,
      },
      applied_amount: 20,
      exchange_rate: 2,
      allocated_at: expect.any(String),
      invoice: {
        id: fixture.invoice.id,
        number: fixture.invoice.number,
        total: 25,
        paid_amount: 20,
        balance_due: 5,
        payment_status: "partial",
      },
    });
    expect(response.body).not.toHaveProperty("created_by");

    const allocation = await PaymentAllocation.findByPk(response.body.id);
    expect(allocation).toMatchObject({
      payment_id: fixture.paymentId,
      invoice_id: fixture.invoice.id,
      amount: "10.00",
      applied_amount: "20.00",
      exchange_rate: "2.000000",
      created_by_user_id: fixture.admin.user.id,
    });

    const wallet = await CustomerWallet.findOne({
      where: { customer_id: fixture.customer.id },
    });
    expect(wallet.balance).toBe("90.00");

    const movement = await WalletTransaction.findOne({
      where: { payment_allocation_id: allocation.id },
    });
    expect(movement).toMatchObject({
      wallet_id: wallet.id,
      transaction_type: "invoice_payment",
      amount: "-10.00",
      balance_after: "90.00",
      payment_id: fixture.paymentId,
      invoice_id: fixture.invoice.id,
      created_by_user_id: fixture.admin.user.id,
    });

    const invoice = await Invoice.findByPk(fixture.invoice.id);
    expect(invoice).toMatchObject({
      paid_amount: "20.00",
      payment_status: "partial",
    });
  });

  it("marks the invoice as paid and refuses a second payment", async () => {
    const fixture = await buildInvoicePaymentFixture({
      deposit: 100,
      total: 25,
    });
    const second = await Payment.create({
      customer_id: fixture.customer.id,
      method_payment_id: fixture.method.id,
      currency_id: fixture.currency.id,
      amount: 50,
      paid_at: new Date(),
      status: "conciliated",
      created_by_user_id: fixture.admin.user.id,
    });

    const first = await applyPayment(fixture, { amount: 12.5 });
    expect(first.status).toBe(201);
    expect(first.body.invoice).toMatchObject({
      paid_amount: 25,
      balance_due: 0,
      payment_status: "paid",
    });

    const rejected = await applyPayment(fixture, {
      payment_id: second.id,
      amount: 1,
    });

    expect(rejected.status).toBe(409);
    expect(rejected.body).toEqual({ message: "Invoice is already paid" });
    expect(await PaymentAllocation.count()).toBe(1);
  });

  it("answers 409 when the payment is already allocated to the invoice", async () => {
    const fixture = await buildInvoicePaymentFixture({
      deposit: 100,
      total: 100,
    });

    expect((await applyPayment(fixture)).status).toBe(201);

    const duplicate = await applyPayment(fixture);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      message: "Payment already allocated to this invoice",
    });
    expect(await PaymentAllocation.count()).toBe(1);
  });

  it("answers 422 when the payment belongs to another customer", async () => {
    const fixture = await buildInvoicePaymentFixture();
    const otherPayment = await Payment.create({
      customer_id: fixture.otherCustomer.id,
      method_payment_id: fixture.method.id,
      currency_id: fixture.currency.id,
      amount: 100,
      paid_at: new Date(),
      status: "conciliated",
      created_by_user_id: fixture.admin.user.id,
    });
    await CustomerWallet.create({
      customer_id: fixture.otherCustomer.id,
      currency_id: fixture.currency.id,
      balance: 100,
    });

    const response = await applyPayment(fixture, {
      payment_id: otherPayment.id,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { payment_id: "Payment does not belong to invoice customer" },
    });
    expect(await PaymentAllocation.count()).toBe(0);
  });

  it("answers 422 when the applied amount exceeds the invoice balance", async () => {
    const fixture = await buildInvoicePaymentFixture({ total: 25 });
    const walletBefore = await CustomerWallet.findOne({
      where: { customer_id: fixture.customer.id },
    });

    const response = await applyPayment(fixture, { amount: 13 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { amount: "Amount exceeds invoice balance" },
    });
    expect(await PaymentAllocation.count()).toBe(0);
    expect(
      await WalletTransaction.count({
        where: { transaction_type: "invoice_payment" },
      }),
    ).toBe(0);
    const walletAfter = await CustomerWallet.findByPk(walletBefore.id);
    expect(walletAfter.balance).toBe(walletBefore.balance);
  });

  it("answers 409 when the wallet has not enough balance", async () => {
    const fixture = await buildInvoicePaymentFixture({
      deposit: 5,
      total: 25,
      invoiceRate: "900.000000",
    });
    const walletBefore = await CustomerWallet.findOne({
      where: { customer_id: fixture.customer.id },
    });

    const response = await applyPayment(fixture, { amount: 10 });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Insufficient wallet balance",
    });
    expect(await PaymentAllocation.count()).toBe(0);
    const walletAfter = await CustomerWallet.findByPk(walletBefore.id);
    expect(walletAfter.balance).toBe("5.00");
  });

  it("answers 404 for unknown invoices and payments", async () => {
    const fixture = await buildInvoicePaymentFixture();
    const missingInvoice = await as(
      "post",
      "/invoices/999999/payments",
      fixture.sellerToken,
    ).send({ payment_id: fixture.paymentId, amount: 1 });
    const missingPayment = await applyPayment(fixture, {
      payment_id: 999999,
    });

    expect(missingInvoice.status).toBe(404);
    expect(missingInvoice.body).toEqual({ message: "Invoice not found" });
    expect(missingPayment.status).toBe(404);
    expect(missingPayment.body).toEqual({ message: "Payment not found" });
  });

  it("validates the id, the required fields and the amount format", async () => {
    const fixture = await buildInvoicePaymentFixture();
    const invalidId = await as(
      "post",
      "/invoices/abc/payments",
      fixture.sellerToken,
    ).send({ payment_id: fixture.paymentId, amount: 1 });
    const missing = await as(
      "post",
      `/invoices/${fixture.invoice.id}/payments`,
      fixture.sellerToken,
    ).send({});
    const invalidAmount = await applyPayment(fixture, { amount: 1.234 });

    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({ errors: { id: "Invalid invoice id" } });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "payment_id and amount are required",
    });
    expect(invalidAmount.status).toBe(422);
    expect(invalidAmount.body.errors.amount).toBeDefined();
  });

  it.each(["customer", "dispatcher", "manager_warehouse", "support"])(
    "answers 403 for a %s",
    async (role) => {
      const fixture = await buildInvoicePaymentFixture();
      const token =
        role === "customer"
          ? fixture.customerToken
          : (await tokenFor(role)).token;

      const response = await applyPayment(fixture, {}, token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});
