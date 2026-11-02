process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Payment = require("../models/payment");
const PaymentStatusHistory = require("../models/payment-status-history");
const CustomerWallet = require("../models/customer-wallet");
const WalletTransaction = require("../models/wallet-transaction");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  buildFixture,
  changeStatus,
  createPendingPayment,
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

describe("payment history visibility", () => {
  it("returns the actor to staff only", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture);

    const staff = await as(
      "get",
      `/payments/${created.body.id}/history`,
      fixture.sellerToken,
    );
    expect(staff.status).toBe(200);
    expect(staff.body).toEqual([
      {
        id: expect.any(Number),
        from_status: null,
        to_status: "pending",
        reason: null,
        created_at: expect.any(String),
        actor: {
          id: expect.any(Number),
          username: expect.any(String),
          email: expect.any(String),
        },
      },
    ]);

    const customer = await as(
      "get",
      `/payments/${created.body.id}/history`,
      fixture.customerToken,
    );
    expect(customer.status).toBe(403);
  });

  it("lets the customer see status and reason but not the history actor", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture);
    await changeStatus(fixture, created.body.id, {
      status: "rejected",
      reason: "Comprobante ilegible",
    });

    const response = await as(
      "get",
      `/payments/${created.body.id}`,
      fixture.customerToken,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "rejected",
      status_name: "Rechazado",
      rejection_reason: "Comprobante ilegible",
      reference_image: null,
    });
    expect(response.body).not.toHaveProperty("history");
    expect(JSON.stringify(response.body)).not.toContain("admin");
  });

  it("enforces staff permissions on the status endpoints", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture);
    const unlinked = await tokenFor("customer");

    for (const session of [
      { token: fixture.customerToken },
      unlinked,
      await tokenFor("dispatcher"),
      await tokenFor("manager_warehouse"),
      await tokenFor("support"),
    ]) {
      const response = await changeStatus(
        fixture,
        created.body.id,
        { status: "conciliated" },
        session.token,
      );
      expect(response.status).toBe(403);
    }

    expect(await WalletTransaction.count()).toBe(0);
  });
});

describe("DELETE /payments/:id under HU-47", () => {
  it("deletes a pending payment without touching the wallet", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture);

    const response = await as(
      "delete",
      `/payments/${created.body.id}`,
      fixture.adminToken,
    );

    expect(response.status).toBe(204);
    expect(await Payment.findByPk(created.body.id)).toBeNull();
    expect(await PaymentStatusHistory.count()).toBe(0);
    expect(await CustomerWallet.count()).toBe(0);
  });

  it("keeps reverting the deposit of a conciliated payment", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture, { amount: 75 });
    const conciliated = await changeStatus(fixture, created.body.id, {
      status: "conciliated",
    });

    const response = await as(
      "delete",
      `/payments/${created.body.id}`,
      fixture.adminToken,
    );

    expect(response.status).toBe(204);
    const wallet = await CustomerWallet.findByPk(conciliated.body.wallet.id);
    expect(Number(wallet.balance)).toBe(0);
    expect(await WalletTransaction.count()).toBe(0);
  });
});
