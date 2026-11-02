process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const PaymentAllocation = require("../models/payment-allocation");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  changeStatus,
  createPendingPayment,
} = require("../../test/helpers/payments");
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
 * Applies a payment to the invoice through the API.
 * @param {object} fixture - Invoice fixture.
 * @param {number} paymentId - Payment id.
 * @returns {Promise<import("supertest").Response>} Response.
 */
function applyPayment(fixture, paymentId) {
  return as(
    "post",
    `/invoices/${fixture.invoice.id}/payments`,
    fixture.adminToken,
  ).send({ payment_id: paymentId, amount: 1 });
}

describe("invoice payments only accept conciliated payments", () => {
  it("rejects a pending payment without creating an allocation", async () => {
    const fixture = await buildInvoicePaymentFixture({ total: 25 });
    const pending = await createPendingPayment(fixture, { amount: 10 });

    const response = await applyPayment(fixture, pending.body.id);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { payment_id: "Payment is not conciliated" },
    });
    expect(await PaymentAllocation.count()).toBe(0);
  });

  it("rejects a rejected payment without creating an allocation", async () => {
    const fixture = await buildInvoicePaymentFixture({ total: 25 });
    const rejected = await createPendingPayment(fixture, { amount: 10 });
    await changeStatus(fixture, rejected.body.id, {
      status: "rejected",
      reason: "Comprobante inválido",
    });

    const response = await applyPayment(fixture, rejected.body.id);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { payment_id: "Payment is not conciliated" },
    });
    expect(await PaymentAllocation.count()).toBe(0);
  });

  it("accepts a payment after it is conciliated", async () => {
    const fixture = await buildInvoicePaymentFixture({ total: 25 });
    const pending = await createPendingPayment(fixture, { amount: 10 });
    await changeStatus(fixture, pending.body.id, { status: "conciliated" });

    const response = await applyPayment(fixture, pending.body.id);

    expect(response.status).toBe(201);
    expect(await PaymentAllocation.count()).toBe(1);
  });
});
