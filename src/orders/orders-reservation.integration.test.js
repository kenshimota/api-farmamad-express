process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  assignSeller,
  createOrderFixture,
  setWalletBalance,
} = require("../../test/helpers/order-lifecycle");
const { createLot } = require("../../test/helpers/orders");
const { ensurePaymentTerm } = require("../../test/helpers/payment-terms");
const {
  Stock,
  as,
  resetDatabase,
  sessionFor,
} = require("../../test/helpers/orders");

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

/** Builds a line for a fixture. */
function lineFor(fixture, quantity = 1) {
  return {
    product_id: fixture.product.id,
    item_state_id: fixture.itemState.id,
    quantity,
  };
}

/** Creates a draft with one line. */
function createDraft(fixture, quantity = 1) {
  return as("post", "/orders", fixture.token).send({
    items: [lineFor(fixture, quantity)],
  });
}

/** Sends a status transition. */
function transition(orderId, status, token) {
  return as("put", `/orders/${orderId}/status`, token).send({ status });
}

describe("order request and reservation with a real database", () => {
  it("freezes prices on request without reserving stock", async () => {
    const fixture = await createOrderFixture({ stock: 10 });
    const created = await createDraft(fixture, 2);

    const requested = await transition(
      created.body.id,
      "request",
      fixture.token,
    );

    expect(requested.status).toBe(202);
    expect(requested.body).toMatchObject({
      status: "request",
      subtotal: 28.58,
      total: 28.58,
    });
    expect(requested.body.history.at(-1)).toMatchObject({
      event_type: "status_changed",
      from_status: "draft",
      to_status: "request",
    });

    await Cost.update(
      { cost: "50.00" },
      { where: { product_id: fixture.product.id } },
    );
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(0);
    expect(await OrderItemLotAllocation.count()).toBe(0);

    const detail = await as("get", `/orders/${created.body.id}`, fixture.token);
    expect(detail.body.items[0].unit_price).toBe(14.29);
    expect(detail.body.total).toBe(28.58);
  });

  it("rejects request without an active payment term", async () => {
    const fixture = await createOrderFixture();
    await fixture.customer.update({ payment_term_id: null });
    const created = await createDraft(fixture);

    const missing = await transition(created.body.id, "request", fixture.token);
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { payment_term_id: "Payment term is required" },
    });
  });

  it("reserves lots FEFO on generation and keeps physical stock", async () => {
    const fixture = await createOrderFixture({ stock: 2, reserved: 1 });
    const newest = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      { stock: 10, reserved: 0, expiration_date: "2027-12-31" },
    );
    await fixture.stockRow.update({ quantity: 12 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 5);

    await transition(created.body.id, "request", fixture.token);
    const generated = await transition(
      created.body.id,
      "generate",
      admin.token,
    );

    expect(generated.status).toBe(202);
    expect(generated.body.status).toBe("generate");

    await fixture.lot.reload();
    await newest.reload();
    expect(fixture.lot.reserved).toBe(2);
    expect(newest.reserved).toBe(4);
    expect(fixture.lot.stock).toBe(2);
    expect(newest.stock).toBe(10);

    const allocations = await OrderItemLotAllocation.findAll({
      order: [["id", "ASC"]],
    });
    expect(
      allocations.map((allocation) => ({
        lot_id: allocation.lot_id,
        quantity: allocation.quantity,
        status: allocation.status,
      })),
    ).toEqual([
      { lot_id: fixture.lot.id, quantity: 1, status: "reserved" },
      { lot_id: newest.id, quantity: 4, status: "reserved" },
    ]);

    const stock = await Stock.findOne({
      where: {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
      },
    });
    expect(stock.quantity).toBe(12);
  });

  it("keeps the order in request and writes nothing when stock is missing", async () => {
    const fixture = await createOrderFixture({ stock: 1 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 2);

    await transition(created.body.id, "request", fixture.token);
    const generated = await transition(
      created.body.id,
      "generate",
      admin.token,
    );

    expect(generated.status).toBe(409);
    expect(generated.body).toEqual({
      message: "Insufficient stock",
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
        },
      ],
    });

    const detail = await as("get", `/orders/${created.body.id}`, admin.token);
    expect(detail.body.status).toBe("request");
    expect(await OrderItemLotAllocation.count()).toBe(0);
  });

  it("lets an assigned seller generate directly from draft", async () => {
    const fixture = await createOrderFixture();
    const seller = await sessionFor("seller");
    await assignSeller(fixture.customer, seller.user);
    const created = await as("post", "/orders", seller.token).send({
      customer_id: fixture.customer.id,
      items: [lineFor(fixture)],
    });

    const generated = await transition(
      created.body.id,
      "generate",
      seller.token,
    );

    expect(generated.status).toBe(202);
    expect(generated.body.status).toBe("generate");
    expect(generated.body.history.at(-1)).toMatchObject({
      from_status: "draft",
      to_status: "generate",
    });
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(1);
  });

  it("requires wallet balance for cash orders but not for credit", async () => {
    const cash = await createOrderFixture({ term: "cash" });
    const cashDraft = await createDraft(cash);
    const admin = await sessionFor("admin");

    const insufficient = await transition(
      cashDraft.body.id,
      "generate",
      admin.token,
    );
    expect(insufficient.status).toBe(409);
    expect(insufficient.body).toEqual({
      message: "Insufficient wallet balance",
    });

    const currency = await Currency.findByPk(cash.cost.currency_id);
    await setWalletBalance(cash.customer, currency, 100);
    const generated = await transition(
      cashDraft.body.id,
      "generate",
      admin.token,
    );
    expect(generated.status).toBe(202);

    const credit10 = await ensurePaymentTerm("credit_10");
    await cash.customer.update({ payment_term_id: credit10.id });
    const creditDraft = await createDraft(cash);
    const creditGenerated = await transition(
      creditDraft.body.id,
      "generate",
      admin.token,
    );
    expect(creditGenerated.status).toBe(202);
  });

  it("releases the reservation on cancellation once", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 2);

    await transition(created.body.id, "generate", admin.token);
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(2);

    const cancelled = await transition(
      created.body.id,
      "cancelled",
      admin.token,
    );
    expect(cancelled.status).toBe(202);
    expect(cancelled.body.status).toBe("cancelled");
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(0);
    expect(fixture.lot.stock).toBe(5);

    const allocations = await OrderItemLotAllocation.findAll();
    expect(allocations.map((allocation) => allocation.status)).toEqual([
      "released",
    ]);

    const again = await transition(created.body.id, "cancelled", admin.token);
    expect(again.status).toBe(422);
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(0);
  });

  it("lets only one of two concurrent generations take the last unit", async () => {
    const fixture = await createOrderFixture({ stock: 1 });
    const admin = await sessionFor("admin");
    const first = await createDraft(fixture, 1);
    const second = await createDraft(fixture, 1);

    const responses = await Promise.all([
      transition(first.body.id, "generate", admin.token),
      transition(second.body.id, "generate", admin.token),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([202, 409]);
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(1);
  });
});
