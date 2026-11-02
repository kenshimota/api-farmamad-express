process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  createOrderFixture,
  assignSeller,
} = require("../../test/helpers/order-lifecycle");
const {
  Order,
  OrderHistory,
  OrderItem,
  as,
  createCustomer,
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
 * Builds a request line for a fixture.
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

describe("draft orders with a real database", () => {
  it("creates a customer draft with items without reserving stock", async () => {
    const fixture = await createOrderFixture();

    const response = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
      delivery_address: "Av. Monseñor Rivero 123",
      notes: "Entregar por la tarde",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "draft",
      customer_id: fixture.customer.id,
      user_id: fixture.user.id,
      subtotal: 28.58,
      total: 28.58,
      payment_term_id: fixture.paymentTerm.id,
      notes: "Entregar por la tarde",
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: fixture.itemState.id,
          quantity: 2,
          unit_price: 14.29,
          subtotal: 28.58,
        },
      ],
      history: [
        {
          event_type: "created",
          from_status: null,
          to_status: "draft",
          metadata: null,
        },
      ],
    });

    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(0);
    expect(await OrderItemLotAllocation.count()).toBe(0);
  });

  it("adds, updates and removes draft lines without touching stock", async () => {
    const fixture = await createOrderFixture({ stock: 5 });

    const created = await as("post", "/orders", fixture.token).send({});
    expect(created.status).toBe(201);
    expect(created.body.items).toEqual([]);
    expect(created.body.subtotal).toBe(0);

    const added = await as(
      "post",
      `/orders/${created.body.id}/items`,
      fixture.token,
    ).send(lineFor(fixture, 2));

    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ subtotal: 28.58, total: 28.58 });
    expect(added.body.history.at(-1)).toMatchObject({
      event_type: "item_added",
      metadata: {
        product_id: fixture.product.id,
        item_state_id: fixture.itemState.id,
        quantity: 2,
      },
    });

    const itemId = added.body.items[0].id;
    const updated = await as(
      "put",
      `/orders/${created.body.id}/items/${itemId}`,
      fixture.token,
    ).send({ quantity: 3 });
    expect(updated.status).toBe(202);
    expect(updated.body.total).toBe(42.87);
    expect(updated.body.history.at(-1)).toMatchObject({
      event_type: "item_updated",
      metadata: { quantity: 3 },
    });

    const removed = await as(
      "delete",
      `/orders/${created.body.id}/items/${itemId}`,
      fixture.token,
    );
    expect(removed.status).toBe(204);

    const stored = await Order.findByPk(created.body.id);
    expect(stored.subtotal).toBe("0.00");
    await fixture.lot.reload();
    expect(fixture.lot.reserved).toBe(0);
    expect(await OrderItem.count()).toBe(0);
    expect(await OrderHistory.count()).toBe(4);
  });

  it("creates assisted orders for assigned sellers and any admin", async () => {
    const fixture = await createOrderFixture();
    const seller = await sessionFor("seller");
    const admin = await sessionFor("admin");
    await assignSeller(fixture.customer, seller.user);

    const sellerResponse = await as("post", "/orders", seller.token).send({
      customer_id: fixture.customer.id,
      items: [lineFor(fixture, 1)],
    });
    expect(sellerResponse.status).toBe(201);
    expect(sellerResponse.body).toMatchObject({
      status: "draft",
      customer_id: fixture.customer.id,
      user_id: seller.user.id,
    });

    const adminResponse = await as("post", "/orders", admin.token).send({
      customer_id: fixture.customer.id,
    });
    expect(adminResponse.status).toBe(201);
    expect(adminResponse.body.user_id).toBe(admin.user.id);
  });

  it("rejects unassigned sellers, missing customer_id and unlinked customers", async () => {
    const fixture = await createOrderFixture();
    const seller = await sessionFor("seller");

    const unassigned = await as("post", "/orders", seller.token).send({
      customer_id: fixture.customer.id,
    });
    expect(unassigned.status).toBe(403);
    expect(unassigned.body).toEqual({
      message: "Customer is not assigned to this seller",
    });

    const missing = await as("post", "/orders", seller.token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "customer_id is required" });

    const unlinkedCustomer = await createCustomer({ price_list_id: null });
    const unlinkedSuffix = Date.now();
    const unlinked = await sessionFor("customer", {
      customer_id: unlinkedCustomer.id,
      username: `unlinked_${unlinkedSuffix}`,
      email: `unlinked-${unlinkedSuffix}@example.com`,
    });
    const response = await as("post", "/orders", unlinked.token).send({});
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Customer price list is not assigned",
    });
  });
});
