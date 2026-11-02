process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Invoice = require("../models/invoice");
const InvoiceItem = require("../models/invoice-item");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createOrderFixture } = require("../../test/helpers/order-lifecycle");
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

/**
 * Builds a line for a fixture.
 * @param {object} fixture - Sale fixture.
 * @param {number} [quantity] - Quantity.
 * @returns {object} The line.
 */
function lineFor(fixture, quantity = 2) {
  return {
    product_id: fixture.product.id,
    item_state_id: fixture.itemState.id,
    quantity,
  };
}

/**
 * Sends a status transition.
 * @param {number} orderId - Order id.
 * @param {string} status - Destination status.
 * @param {string} token - Bearer token.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function transition(orderId, status, token) {
  return as("put", `/orders/${orderId}/status`, token).send({ status });
}

describe("order invoicing with a real database", () => {
  it("consumes the reservation, creates the invoice and exposes it", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
    });

    await transition(created.body.id, "generate", admin.token);
    const invoiced = await transition(created.body.id, "invoiced", admin.token);

    expect(invoiced.status).toBe(202);
    expect(invoiced.body.status).toBe("invoiced");
    expect(invoiced.body.history.slice(-2)).toMatchObject([
      {
        event_type: "status_changed",
        from_status: "generate",
        to_status: "invoiced",
      },
      {
        event_type: "invoice_issued",
        from_status: "generate",
        to_status: "invoiced",
        metadata: {
          invoice_id: expect.any(Number),
          invoice_number: expect.any(Number),
        },
      },
    ]);

    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(0);
    expect(fixture.lot.stock).toBe(3);
    const stock = await Stock.findOne({
      where: {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
      },
    });
    expect(stock.quantity).toBe(3);
    const allocations = await OrderItemLotAllocation.findAll();
    expect(allocations.map((allocation) => allocation.status)).toEqual([
      "consumed",
    ]);

    const invoice = await Invoice.findOne({
      where: { order_id: created.body.id },
    });
    expect(invoice).toMatchObject({
      customer_id: fixture.customer.id,
      currency_id: fixture.cost.currency_id,
      payment_term_id: fixture.paymentTerm.id,
      subtotal: "28.58",
      total: "28.58",
      paid_amount: "0.00",
      payment_status: "pending",
    });
    expect(await InvoiceItem.count({ where: { invoice_id: invoice.id } })).toBe(
      1,
    );

    const customerInvoice = await as(
      "get",
      `/orders/${created.body.id}/invoice`,
      fixture.token,
    );
    expect(customerInvoice.status).toBe(200);
    expect(customerInvoice.body).toMatchObject({
      id: invoice.id,
      order_id: created.body.id,
      total: 28.58,
      items: [
        {
          order_item_id: expect.any(Number),
          product_id: fixture.product.id,
          quantity: 2,
          unit_price: 14.29,
          subtotal: 28.58,
        },
      ],
    });
    expect(customerInvoice.body).not.toHaveProperty("invoiced_by");
  });

  it("does not invoice nor cancel an invoiced order twice", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture, 1)],
    });

    await transition(created.body.id, "generate", admin.token);
    await transition(created.body.id, "invoiced", admin.token);

    const cancel = await transition(created.body.id, "cancelled", admin.token);
    expect(cancel.status).toBe(422);
    expect(cancel.body).toEqual({
      errors: { status: "Invalid status transition" },
    });

    const again = await transition(created.body.id, "invoiced", admin.token);
    expect(again.status).toBe(422);
    await fixture.lot.reload();
    expect(fixture.lot.stock).toBe(4);
    expect(fixture.lot.reserved).toBe(0);
  });

  it("rolls back the invoice when the term became inactive", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture, 1)],
    });

    await transition(created.body.id, "generate", admin.token);
    await fixture.paymentTerm.update({ is_active: false });
    const invoiced = await transition(created.body.id, "invoiced", admin.token);

    expect(invoiced.status).toBe(422);
    expect(invoiced.body).toEqual({
      errors: { payment_term_id: "Invalid payment term" },
    });

    const detail = await as("get", `/orders/${created.body.id}`, admin.token);
    expect(detail.body.status).toBe("generate");
    expect(await Invoice.count()).toBe(0);
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(1);
    expect(fixture.lot.stock).toBe(5);
  });
});
