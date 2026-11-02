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

describe("DELETE /payments/:id with a real database", () => {
  it("reverts the wallet deposit and removes the payment and movement", async () => {
    const fixture = await buildFixture();
    const { response, wallet } = await deposit(fixture);

    const removed = await as(
      "delete",
      `/payments/${response.body.id}`,
      fixture.adminToken,
    );

    expect(removed.status).toBe(204);
    expect(removed.text).toBe("");
    expect(await Payment.findByPk(response.body.id)).toBeNull();

    const stored = await CustomerWallet.findByPk(wallet.id);
    expect(Number(stored.balance)).toBe(0);
    expect(
      await WalletTransaction.count({
        where: { payment_id: response.body.id },
      }),
    ).toBe(0);
  });

  it("keeps the other deposits when one payment is deleted", async () => {
    const fixture = await buildFixture();
    const first = await deposit(fixture, { amount: 100 });
    const second = await deposit(fixture, { amount: 30 });

    const removed = await as(
      "delete",
      `/payments/${first.response.body.id}`,
      fixture.adminToken,
    );

    expect(removed.status).toBe(204);
    const stored = await CustomerWallet.findByPk(second.wallet.id);
    expect(Number(stored.balance)).toBe(30);
  });

  it("refuses to leave a negative balance", async () => {
    const fixture = await buildFixture();
    const { response, wallet } = await deposit(fixture);

    await wallet.update({ balance: 50 });

    const removed = await as(
      "delete",
      `/payments/${response.body.id}`,
      fixture.adminToken,
    );

    expect(removed.status).toBe(409);
    expect(removed.body).toEqual({
      message: "Wallet balance would become negative",
    });
    expect(await Payment.findByPk(response.body.id)).not.toBeNull();
  });

  it("only allows admin to delete", async () => {
    const fixture = await buildFixture();
    const { response } = await deposit(fixture);

    const seller = await as(
      "delete",
      `/payments/${response.body.id}`,
      fixture.sellerToken,
    );
    expect(seller.status).toBe(403);

    const customer = await as(
      "delete",
      `/payments/${response.body.id}`,
      fixture.customerToken,
    );
    expect(customer.status).toBe(403);

    const admin = await as(
      "delete",
      `/payments/${response.body.id}`,
      fixture.adminToken,
    );
    expect(admin.status).toBe(204);
  });
});
