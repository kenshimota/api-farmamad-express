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

describe("POST /payments under HU-47", () => {
  it("creates a pending payment without creating wallet or deposit", async () => {
    const fixture = await buildFixture();

    const response = await createPendingPayment(fixture, { amount: 100 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      customer_id: fixture.customer.id,
      amount: 100,
      status: "pending",
      status_name: "Pendiente",
      rejection_reason: null,
      reference_image_id: null,
      reference_image: null,
      wallet: null,
    });

    expect(
      await CustomerWallet.count({
        where: { customer_id: fixture.customer.id },
      }),
    ).toBe(0);
    expect(await WalletTransaction.count()).toBe(0);

    const history = await PaymentStatusHistory.findAll({
      where: { payment_id: response.body.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      from_status: null,
      to_status: "pending",
      reason: null,
      actor_user_id: expect.any(Number),
    });
  });

  it("lists and filters by status and exposes the fields in the detail", async () => {
    const fixture = await buildFixture();
    const pending = await createPendingPayment(fixture, { amount: 10 });
    const conciliated = await createPendingPayment(fixture, { amount: 20 });
    await changeStatus(fixture, conciliated.body.id, {
      status: "conciliated",
    });

    const pendingList = await as(
      "get",
      "/payments?status=pending",
      fixture.sellerToken,
    );
    const conciliatedList = await as(
      "get",
      "/payments?status=conciliated",
      fixture.sellerToken,
    );
    const detail = await as(
      "get",
      `/payments/${conciliated.body.id}`,
      fixture.adminToken,
    );

    expect(pendingList.status).toBe(200);
    expect(pendingList.body.map((row) => row.id)).toEqual([pending.body.id]);
    expect(pendingList.body[0]).toMatchObject({
      status: "pending",
      status_name: "Pendiente",
      rejection_reason: null,
    });
    expect(conciliatedList.body.map((row) => row.id)).toEqual([
      conciliated.body.id,
    ]);
    expect(detail.body).toMatchObject({
      status: "conciliated",
      status_name: "Conciliado",
      rejection_reason: null,
      reference_image_id: null,
      reference_image: null,
    });
    expect(detail.body.history).toHaveLength(2);
    expect(detail.body.history[1]).toMatchObject({
      from_status: "pending",
      to_status: "conciliated",
      actor: {
        id: expect.any(Number),
        username: expect.any(String),
        email: expect.any(String),
      },
    });
  });
});

describe("PUT /payments/:id/status", () => {
  it("conciliates once, credits the wallet and appends exactly one deposit", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture, { amount: 100 });

    const response = await changeStatus(fixture, created.body.id, {
      status: "conciliated",
      reason: "  Transferencia verificada  ",
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      id: created.body.id,
      status: "conciliated",
      status_name: "Conciliado",
      rejection_reason: null,
      wallet: {
        id: expect.any(Number),
        customer_id: fixture.customer.id,
        currency_id: fixture.currency.id,
        balance: 100,
      },
    });

    expect(await WalletTransaction.count()).toBe(1);
    const movement = await WalletTransaction.findOne();
    expect(movement).toMatchObject({
      transaction_type: "deposit",
      payment_id: created.body.id,
      created_by_user_id: expect.any(Number),
    });
    expect(Number(movement.balance_after)).toBe(100);

    const history = await PaymentStatusHistory.findAll({
      where: { payment_id: created.body.id },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      from_status: "pending",
      to_status: "conciliated",
      reason: "Transferencia verificada",
    });
  });

  it("does not credit twice when two conciliations run concurrently", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture, { amount: 100 });

    const responses = await Promise.all([
      changeStatus(fixture, created.body.id, { status: "conciliated" }),
      changeStatus(fixture, created.body.id, { status: "conciliated" }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      202, 422,
    ]);
    expect(await WalletTransaction.count()).toBe(1);

    const wallet = await CustomerWallet.findOne({
      where: {
        customer_id: fixture.customer.id,
        currency_id: fixture.currency.id,
      },
    });
    expect(Number(wallet.balance)).toBe(100);

    const history = await PaymentStatusHistory.findAll({
      where: { payment_id: created.body.id },
    });
    expect(history).toHaveLength(2);

    const conflict = responses.find((response) => response.status === 422);
    expect(conflict.body).toEqual({
      errors: { status: "Invalid status transition" },
    });
  });

  it("rejects a payment with a reason without touching the wallet", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture, { amount: 100 });

    const response = await changeStatus(fixture, created.body.id, {
      status: "rejected",
      reason: "  El monto no coincide  ",
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      status: "rejected",
      status_name: "Rechazado",
      rejection_reason: "El monto no coincide",
      wallet: null,
    });
    expect(await CustomerWallet.count()).toBe(0);
    expect(await WalletTransaction.count()).toBe(0);

    const stored = await Payment.findByPk(created.body.id);
    expect(stored.status).toBe("rejected");
    expect(stored.rejection_reason).toBe("El monto no coincide");

    const history = await PaymentStatusHistory.findAll({
      where: { payment_id: created.body.id },
    });
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      from_status: "pending",
      to_status: "rejected",
      reason: "El monto no coincide",
    });
  });

  it("validates the body, the transition and the terminal states", async () => {
    const fixture = await buildFixture();
    const created = await createPendingPayment(fixture);

    const withoutReason = await changeStatus(fixture, created.body.id, {
      status: "rejected",
    });
    expect(withoutReason.status).toBe(422);
    expect(withoutReason.body).toEqual({
      errors: { reason: "reason is required when the payment is rejected" },
    });

    const sameStatus = await changeStatus(fixture, created.body.id, {
      status: "conciliated",
    });
    expect(sameStatus.status).toBe(202);

    const repeated = await changeStatus(fixture, created.body.id, {
      status: "conciliated",
    });
    expect(repeated.status).toBe(422);
    expect(repeated.body).toEqual({
      errors: { status: "Invalid status transition" },
    });

    const rejected = await changeStatus(fixture, created.body.id, {
      status: "rejected",
      reason: "Motivo válido",
    });
    expect(rejected.status).toBe(422);
    expect(rejected.body).toEqual({
      errors: { status: "Invalid status transition" },
    });

    const unknown = await changeStatus(fixture, created.body.id, {
      status: "other",
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body.errors).toHaveProperty("status");
  });
});
