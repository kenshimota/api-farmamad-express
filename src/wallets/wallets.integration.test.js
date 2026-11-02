process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
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

describe("GET /customer-wallets with a real database", () => {
  it("lists every wallet of the customer ordered by currency", async () => {
    const first = await buildFixture();
    const secondCurrency = await buildFixture({ customer: first.customer });
    const firstPayment = await createPayment(first, { amount: 10 });
    const secondPayment = await createPayment(
      { ...first, method: secondCurrency.method },
      { amount: 20 },
    );

    const response = await as(
      "get",
      `/customer-wallets?customer_id=${first.customer.id}`,
      first.sellerToken,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((wallet) => wallet.currency_id)).toEqual(
      [first.currency.id, secondCurrency.currency.id].sort((a, b) => a - b),
    );
    expect(response.body.map((wallet) => wallet.id)).toEqual(
      expect.arrayContaining([
        firstPayment.body.wallet.id,
        secondPayment.body.wallet.id,
      ]),
    );
    expect(response.body[0].currency).toEqual(
      expect.objectContaining({ code: expect.any(String), symbol: "$" }),
    );
  });

  it("lets a customer read only its own wallets", async () => {
    const fixture = await buildFixture();
    await createPayment(fixture);

    const own = await as(
      "get",
      `/customer-wallets?customer_id=${fixture.customer.id}`,
      fixture.customerToken,
    );
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);

    const withoutQuery = await as(
      "get",
      "/customer-wallets",
      fixture.customerToken,
    );
    expect(withoutQuery.status).toBe(200);

    const other = await as(
      "get",
      `/customer-wallets?customer_id=${fixture.otherCustomer.id}`,
      fixture.customerToken,
    );
    expect(other.status).toBe(403);
  });

  it("enforces the staff contract and role permissions", async () => {
    const fixture = await buildFixture();

    const missing = await as("get", "/customer-wallets", fixture.adminToken);
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "customer_id is required" });

    for (const role of ["dispatcher", "support"]) {
      const session = await tokenFor(role);
      const forbidden = await as(
        "get",
        `/customer-wallets?customer_id=${fixture.customer.id}`,
        session.token,
      );
      expect(forbidden.status).toBe(403);
    }

    const unlinked = await tokenFor("customer");
    const notLinked = await as("get", "/customer-wallets", unlinked.token);
    expect(notLinked.status).toBe(403);
    expect(notLinked.body).toEqual({
      message: "Customer profile is not linked",
    });

    const invalid = await as(
      "get",
      "/customer-wallets?customer_id=abc",
      fixture.adminToken,
    );
    expect(invalid.status).toBe(422);
  });
});

describe("GET /customer-wallets/:id with a real database", () => {
  it("returns the wallet to staff and its owner", async () => {
    const fixture = await buildFixture();
    const payment = await createPayment(fixture, { amount: 75 });

    const staff = await as(
      "get",
      `/customer-wallets/${payment.body.wallet.id}`,
      fixture.sellerToken,
    );
    expect(staff.status).toBe(200);
    expect(staff.body).toMatchObject({
      id: payment.body.wallet.id,
      customer_id: fixture.customer.id,
      currency_id: fixture.currency.id,
      balance: 75,
    });

    const owner = await as(
      "get",
      `/customer-wallets/${payment.body.wallet.id}`,
      fixture.customerToken,
    );
    expect(owner.status).toBe(200);
  });

  it("hides another customer's wallet and validates the id", async () => {
    const fixture = await buildFixture();
    const payment = await createPayment(fixture);

    const other = await as(
      "get",
      `/customer-wallets/${payment.body.wallet.id}`,
      fixture.otherToken,
    );
    expect(other.status).toBe(404);
    expect(other.body).toEqual({ message: "Wallet not found" });

    const unlinked = await tokenFor("customer");
    const notLinked = await as(
      "get",
      `/customer-wallets/${payment.body.wallet.id}`,
      unlinked.token,
    );
    expect(notLinked.status).toBe(403);

    const invalid = await as(
      "get",
      "/customer-wallets/abc",
      fixture.adminToken,
    );
    expect(invalid.status).toBe(422);

    const missing = await as(
      "get",
      "/customer-wallets/999999",
      fixture.adminToken,
    );
    expect(missing.status).toBe(404);
  });
});

describe("GET /customer-wallets/:id/transactions with a real database", () => {
  it("returns the documented movement fields", async () => {
    const fixture = await buildFixture();
    const payment = await createPayment(fixture, {
      amount: 40,
      reference: "TRX-1",
    });

    const response = await as(
      "get",
      `/customer-wallets/${payment.body.wallet.id}/transactions`,
      fixture.adminToken,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: expect.any(Number),
        transaction_type: "deposit",
        amount: 40,
        balance_after: 40,
        currency: {
          id: fixture.currency.id,
          code: fixture.currency.code,
          name: fixture.currency.name,
          symbol: fixture.currency.symbol,
        },
        payment_id: payment.body.id,
        invoice_id: null,
        payment_allocation_id: null,
        description: "TRX-1",
        created_at: expect.any(String),
        created_by: {
          id: expect.any(Number),
          username: expect.any(String),
          email: expect.any(String),
        },
      },
    ]);
  });

  it("hides another customer's history with 404", async () => {
    const fixture = await buildFixture();
    const payment = await createPayment(fixture);

    const other = await as(
      "get",
      `/customer-wallets/${payment.body.wallet.id}/transactions`,
      fixture.otherToken,
    );
    expect(other.status).toBe(404);
  });
});
