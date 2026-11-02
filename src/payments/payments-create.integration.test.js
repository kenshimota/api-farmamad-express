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

describe("POST /payments with a real database", () => {
  it("creates the wallet, credits the balance and appends the deposit", async () => {
    const fixture = await buildFixture();

    const response = await createPayment(fixture, {
      amount: 100.5,
      reference: "  TRX-123  ",
      notes: "  Depósito Binance  ",
      currency_id: 999,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      customer_id: fixture.customer.id,
      method_payment_id: fixture.method.id,
      method_payment: { id: fixture.method.id, label: fixture.method.label },
      currency_id: fixture.currency.id,
      currency: {
        id: fixture.currency.id,
        code: fixture.currency.code,
        name: fixture.currency.name,
        symbol: fixture.currency.symbol,
      },
      amount: 100.5,
      reference: "TRX-123",
      notes: "Depósito Binance",
      wallet: {
        id: expect.any(Number),
        customer_id: fixture.customer.id,
        currency_id: fixture.currency.id,
        balance: 100.5,
      },
    });
    expect(response.body.paid_at).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const wallet = await CustomerWallet.findByPk(response.body.wallet.id);
    expect(Number(wallet.balance)).toBe(100.5);

    const movement = await WalletTransaction.findOne({
      where: { payment_id: response.body.id },
    });
    expect(movement.transaction_type).toBe("deposit");
    expect(Number(movement.amount)).toBe(100.5);
    expect(Number(movement.balance_after)).toBe(100.5);
    expect(movement.description).toBe("Depósito Binance");
    expect(movement.invoice_id).toBeNull();
    expect(movement.payment_allocation_id).toBeNull();
  });

  it("reuses the wallet on the next deposit and keeps the history newest first", async () => {
    const fixture = await buildFixture();

    const first = await createPayment(fixture, { amount: 100 });
    const second = await createPayment(fixture, { amount: 50 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.wallet.id).toBe(first.body.wallet.id);
    expect(second.body.wallet.balance).toBe(150);

    const wallets = await as(
      "get",
      `/customer-wallets?customer_id=${fixture.customer.id}`,
      fixture.adminToken,
    );
    expect(wallets.status).toBe(200);
    expect(wallets.body).toHaveLength(1);
    expect(wallets.body[0].balance).toBe(150);

    const history = await as(
      "get",
      `/customer-wallets/${first.body.wallet.id}/transactions`,
      fixture.adminToken,
    );
    expect(history.status).toBe(200);
    expect(history.body.map((row) => row.amount)).toEqual([50, 100]);
    expect(history.body.map((row) => row.balance_after)).toEqual([150, 100]);
    expect(history.body[0].created_by).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        username: expect.any(String),
      }),
    );

    const customerHistory = await as(
      "get",
      `/customer-wallets/${first.body.wallet.id}/transactions`,
      fixture.customerToken,
    );
    expect(customerHistory.status).toBe(200);
    expect(customerHistory.body[0]).not.toHaveProperty("created_by");
  });

  it("creates one wallet per customer and currency", async () => {
    const fixture = await buildFixture();
    const secondCurrency = await buildFixture({
      customer: fixture.customer,
    });
    const first = await createPayment(fixture, { amount: 10 });
    const second = await createPayment(
      { ...fixture, method: secondCurrency.method },
      { amount: 20 },
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.wallet.id).not.toBe(first.body.wallet.id);
    expect(second.body.wallet.currency_id).toBe(secondCurrency.currency.id);

    const wallets = await as(
      "get",
      `/customer-wallets?customer_id=${fixture.customer.id}`,
      fixture.adminToken,
    );
    expect(wallets.body).toHaveLength(2);
  });

  it("keeps both deposits when they run concurrently", async () => {
    const fixture = await buildFixture();

    const responses = await Promise.all([
      createPayment(fixture, { amount: 100 }),
      createPayment(fixture, { amount: 50 }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);

    const wallet = await CustomerWallet.findOne({
      where: {
        customer_id: fixture.customer.id,
        currency_id: fixture.currency.id,
      },
    });
    expect(Number(wallet.balance)).toBe(150);

    const movements = await WalletTransaction.findAll({
      where: { wallet_id: wallet.id },
    });
    expect(movements).toHaveLength(2);
    expect(
      movements.reduce((total, row) => total + Number(row.amount), 0),
    ).toBe(150);
  });

  it("responds 400, 404 and 422 for invalid references", async () => {
    const fixture = await buildFixture();

    const missing = await as("post", "/payments", fixture.sellerToken).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "customer_id, method_payment_id and amount are required",
    });

    const customer = await createPayment(fixture, { customer_id: 999999 });
    expect(customer.status).toBe(404);
    expect(customer.body).toEqual({ message: "Customer not found" });

    const method = await createPayment(fixture, { method_payment_id: 999999 });
    expect(method.status).toBe(404);
    expect(method.body).toEqual({ message: "Payment method not found" });

    for (const amount of [0, -5, 1.234, "abc"]) {
      const invalid = await createPayment(fixture, { amount });
      expect(invalid.status).toBe(422);
      expect(invalid.body.errors).toHaveProperty("amount");
    }
  });

  it("rejects inactive methods, types and currencies", async () => {
    const inactiveMethod = await buildFixture({ methodActive: false });
    const methodResponse = await createPayment(inactiveMethod);
    expect(methodResponse.status).toBe(422);
    expect(methodResponse.body).toEqual({
      errors: { method_payment_id: "Invalid payment method" },
    });

    const inactiveType = await buildFixture({ typeActive: false });
    const typeResponse = await createPayment(inactiveType);
    expect(typeResponse.status).toBe(422);

    const currency = await buildFixture();
    const inactiveCurrency = await buildFixture();
    await inactiveCurrency.currency.update({ is_active: false });
    const currencyResponse = await createPayment(inactiveCurrency);
    expect(currencyResponse.status).toBe(422);
    expect(currencyResponse.body.errors).toHaveProperty("method_payment_id");
    expect(currency.id).not.toBe(inactiveCurrency.currency.id);
  });

  it("does not accept currency_id from the body", async () => {
    const fixture = await buildFixture();
    const other = await buildFixture();

    const response = await createPayment(fixture, {
      currency_id: other.currency.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.currency_id).toBe(fixture.currency.id);
    expect(response.body.currency_id).not.toBe(other.currency.id);
  });

  it("enforces the payment permissions", async () => {
    const fixture = await buildFixture();
    const unlinked = await tokenFor("customer");

    const customer = await createPayment(fixture, {}, fixture.customerToken);
    expect(customer.status).toBe(403);

    const noToken = await as("post", "/payments", "").send({
      customer_id: fixture.customer.id,
      method_payment_id: fixture.method.id,
      amount: 1,
    });
    expect(noToken.status).toBe(401);

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await createPayment(fixture, {}, dispatcher.token);
    expect(forbidden.status).toBe(403);
    expect(unlinked.token).toEqual(expect.any(String));
  });
});
