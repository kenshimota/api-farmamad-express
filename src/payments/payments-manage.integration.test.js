process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Payment = require("../models/payment");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  buildFixture,
  createPayment,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/payments");

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
 * Creates a deposit and returns the response plus the stored wallet.
 * @param {object} fixture - Fixture.
 * @param {object} [overrides] - Payment overrides.
 * @returns {Promise<object>} The created response and wallet.
 */
async function deposit(fixture, overrides = {}) {
  const response = await createPayment(fixture, overrides);
  const wallet = await CustomerWallet.findByPk(response.body.wallet.id);

  return { response, wallet };
}

describe("GET /payments with a real database", () => {
  it("lists payments newest first with the method and currency", async () => {
    const fixture = await buildFixture();

    const older = await createPayment(fixture, {
      amount: 10,
      paid_at: "2026-10-01T10:00:00.000Z",
    });
    const newer = await createPayment(fixture, {
      amount: 20,
      paid_at: "2026-11-01T10:00:00.000Z",
    });

    const response = await as("get", "/payments", fixture.sellerToken);

    expect(response.status).toBe(200);
    expect(response.body.map((row) => row.id)).toEqual([
      newer.body.id,
      older.body.id,
    ]);
    expect(response.body[0]).toMatchObject({
      amount: 20,
      method_payment: { id: fixture.method.id, label: fixture.method.label },
      currency: { id: fixture.currency.id },
    });
    expect(response.body[0]).not.toHaveProperty("createdAt");
  });

  it("applies the customer, method, currency and date filters", async () => {
    const first = await buildFixture();
    const second = await buildFixture();
    const firstResponse = await createPayment(first, {
      amount: 10,
      paid_at: "2026-10-01T10:00:00.000Z",
    });
    const secondResponse = await createPayment(second, {
      amount: 20,
      paid_at: "2026-11-15T10:00:00.000Z",
    });

    const byCustomer = await as(
      "get",
      `/payments?customer_id=${first.customer.id}`,
      first.adminToken,
    );
    expect(byCustomer.body.map((row) => row.id)).toEqual([
      firstResponse.body.id,
    ]);

    const byMethod = await as(
      "get",
      `/payments?method_payment_id=${second.method.id}`,
      first.adminToken,
    );
    expect(byMethod.body.map((row) => row.id)).toEqual([
      secondResponse.body.id,
    ]);

    const byCurrency = await as(
      "get",
      `/payments?currency_id=${first.currency.id}`,
      first.adminToken,
    );
    expect(byCurrency.body.map((row) => row.id)).toEqual([
      firstResponse.body.id,
    ]);

    const byRange = await as(
      "get",
      "/payments?paid_from=2026-11-01&paid_to=2026-11-30",
      first.adminToken,
    );
    expect(byRange.body.map((row) => row.id)).toEqual([secondResponse.body.id]);
  });

  it("enforces list and detail permissions", async () => {
    const fixture = await buildFixture();
    const { response } = await deposit(fixture);
    const unlinked = await tokenFor("customer");

    const customerList = await as("get", "/payments", fixture.customerToken);
    expect(customerList.status).toBe(403);

    const own = await as(
      "get",
      `/payments/${response.body.id}`,
      fixture.customerToken,
    );
    expect(own.status).toBe(200);

    const other = await as(
      "get",
      `/payments/${response.body.id}`,
      fixture.otherToken,
    );
    expect(other.status).toBe(404);

    const notLinked = await as(
      "get",
      `/payments/${response.body.id}`,
      unlinked.token,
    );
    expect(notLinked.status).toBe(403);
    expect(notLinked.body).toEqual({
      message: "Customer profile is not linked",
    });

    const missing = await as("get", "/payments/999999", fixture.adminToken);
    expect(missing.status).toBe(404);
  });
});

describe("PUT /payments/:id with a real database", () => {
  it("updates reference, notes and paid_at and answers 202", async () => {
    const fixture = await buildFixture();
    const { response } = await deposit(fixture);

    const updated = await as(
      "put",
      `/payments/${response.body.id}`,
      fixture.sellerToken,
    ).send({
      reference: "  TRX-456  ",
      notes: "  conciliado  ",
      paid_at: "2026-11-02T12:00:00.000Z",
    });

    expect(updated.status).toBe(202);
    expect(updated.body).toMatchObject({
      id: response.body.id,
      reference: "TRX-456",
      notes: "conciliado",
      amount: 100,
      paid_at: "2026-11-02T12:00:00.000Z",
    });

    const stored = await Payment.findByPk(response.body.id);
    expect(stored.reference).toBe("TRX-456");
    expect(stored.notes).toBe("conciliado");
  });

  it("rejects immutable changes and customer edits", async () => {
    const fixture = await buildFixture();
    const { response } = await deposit(fixture);

    for (const [field, value] of [
      ["customer_id", fixture.otherCustomer.id],
      ["method_payment_id", fixture.method.id + 999],
      ["currency_id", fixture.currency.id + 999],
      ["amount", 99],
    ]) {
      const immutable = await as(
        "put",
        `/payments/${response.body.id}`,
        fixture.adminToken,
      ).send({ [field]: value });

      expect(immutable.status).toBe(422);
      expect(immutable.body).toEqual({
        errors: { [field]: `${field} cannot be changed` },
      });
    }

    const customer = await as(
      "put",
      `/payments/${response.body.id}`,
      fixture.customerToken,
    ).send({ notes: "x" });
    expect(customer.status).toBe(403);

    const empty = await as(
      "put",
      `/payments/${response.body.id}`,
      fixture.adminToken,
    ).send({});
    expect(empty.status).toBe(400);
  });

  it("responds 409 when the payment has invoice allocations", async () => {
    const fixture = await buildFixture();
    const { response, wallet } = await deposit(fixture);

    await WalletTransaction.create({
      wallet_id: wallet.id,
      transaction_type: "invoice_payment",
      amount: -10,
      balance_after: 90,
      payment_id: response.body.id,
      invoice_id: 999,
      payment_allocation_id: 888,
      description: "Pago de factura",
      created_by_user_id: fixture.admin.user.id,
    });

    const update = await as(
      "put",
      `/payments/${response.body.id}`,
      fixture.adminToken,
    ).send({ notes: "x" });
    expect(update.status).toBe(409);
    expect(update.body).toEqual({ message: "Payment has allocations" });

    const remove = await as(
      "delete",
      `/payments/${response.body.id}`,
      fixture.adminToken,
    );
    expect(remove.status).toBe(409);
  });
});
