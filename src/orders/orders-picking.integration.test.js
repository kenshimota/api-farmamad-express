process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createOrderFixture } = require("../../test/helpers/order-lifecycle");
const {
  as,
  createLot,
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
 * @returns {object} The line body.
 */
function lineFor(fixture, quantity = 1) {
  return {
    product_id: fixture.product.id,
    item_state_id: fixture.itemState.id,
    quantity,
  };
}

/**
 * Creates a draft with one line using the customer token.
 * @param {object} fixture - Sale fixture.
 * @param {number} quantity - Quantity.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function createDraft(fixture, quantity) {
  return as("post", "/orders", fixture.token).send({
    items: [lineFor(fixture, quantity)],
  });
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

/**
 * Reads the picking list.
 * @param {number} orderId - Order id.
 * @param {string} token - Bearer token.
 * @param {string} [query] - Raw query string without `?`.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function readPicking(orderId, token, query) {
  const suffix = query ? `?${query}` : "";

  return as("get", `/orders/${orderId}/picking${suffix}`, token);
}

describe("order picking with a real database", () => {
  it("returns the reserved allocations grouped by line in FEFO order", async () => {
    const fixture = await createOrderFixture({ stock: 2, reserved: 1 });
    const earliest = await createLot(
      fixture.product,
      fixture.itemState,
      fixture.location,
      { stock: 5, reserved: 0, expiration_date: "2027-01-15" },
    );
    await fixture.stockRow.update({ quantity: 7 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 6);

    await transition(created.body.id, "request", fixture.token);
    const generated = await transition(
      created.body.id,
      "generate",
      admin.token,
    );
    expect(generated.status).toBe(202);

    const response = await readPicking(created.body.id, admin.token);

    expect(response.status).toBe(200);
    expect(response.body.order).toMatchObject({
      id: created.body.id,
      status: "generate",
      customer_id: fixture.customer.id,
      delivery_address: fixture.customer.direction,
    });
    expect(response.body.customer).toEqual({
      id: fixture.customer.id,
      fullName: fixture.customer.fullName,
      email: fixture.customer.email,
      direction: fixture.customer.direction,
    });
    expect(response.body.summary).toEqual({
      lines_count: 1,
      lots_count: 2,
      ordered_units: 6,
      allocated_units: 6,
      pending_units: 0,
      ready: true,
    });
    expect(response.body.items).toHaveLength(1);

    const item = response.body.items[0];

    expect(item).toMatchObject({
      product_id: fixture.product.id,
      item_state_id: fixture.itemState.id,
      quantity: 6,
      allocated_quantity: 6,
      pending_quantity: 0,
      product: {
        id: fixture.product.id,
        name: fixture.product.name,
        reference: fixture.product.reference,
        image_id: fixture.product.image_id,
      },
    });
    expect(item.item_state).toMatchObject({
      id: fixture.itemState.id,
      name: fixture.itemState.name,
      label: fixture.itemState.label,
    });
    expect(
      item.lots.map((allocation) => allocation.lot.expiration_date),
    ).toEqual(["2027-01-15", "2027-03-31"]);
    expect(item.lots.map((allocation) => allocation.quantity)).toEqual([5, 1]);
    expect(item.lots[0]).toMatchObject({
      status: "reserved",
      lot: {
        id: earliest.id,
        number: earliest.number,
        stock: 5,
        reserved: 5,
        available: 0,
        location_status: "located",
        warehouse: { id: fixture.location.warehouse.id },
        shelf: { id: fixture.location.shelf.id },
        section: { id: fixture.location.section.id },
      },
    });

    const consumed = await readPicking(
      created.body.id,
      admin.token,
      "allocation_status=consumed",
    );

    expect(consumed.status).toBe(200);
    expect(consumed.body.items[0].lots).toEqual([]);
    expect(consumed.body.summary).toMatchObject({
      allocated_units: 0,
      pending_units: 6,
      ready: false,
    });
  });

  it("returns the consumed allocations after invoicing", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 2);

    await transition(created.body.id, "generate", admin.token);
    await transition(created.body.id, "invoiced", admin.token);

    const response = await readPicking(created.body.id, admin.token);

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("invoiced");
    expect(response.body.summary).toEqual({
      lines_count: 1,
      lots_count: 1,
      ordered_units: 2,
      allocated_units: 2,
      pending_units: 0,
      ready: true,
    });
    expect(response.body.items[0].lots[0]).toMatchObject({
      quantity: 2,
      status: "consumed",
      lot: {
        id: fixture.lot.id,
        stock: 3,
        reserved: 0,
        available: 3,
      },
    });
  });

  it("returns empty lots for draft, request and cancelled orders", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 3);

    const draft = await readPicking(created.body.id, admin.token);

    expect(draft.status).toBe(200);
    expect(draft.body.order.status).toBe("draft");
    expect(draft.body.items[0]).toMatchObject({
      quantity: 3,
      allocated_quantity: 0,
      pending_quantity: 3,
      lots: [],
    });
    expect(draft.body.summary).toMatchObject({
      lots_count: 0,
      pending_units: 3,
      ready: false,
    });

    await transition(created.body.id, "request", fixture.token);
    const requested = await readPicking(created.body.id, admin.token);

    expect(requested.body.order.status).toBe("request");
    expect(requested.body.items[0].lots).toEqual([]);
    expect(requested.body.summary.ready).toBe(false);

    await transition(created.body.id, "generate", admin.token);
    const generated = await readPicking(created.body.id, admin.token);

    expect(generated.body.items[0].lots).toHaveLength(1);

    await transition(created.body.id, "cancelled", admin.token);
    const cancelled = await readPicking(created.body.id, admin.token);

    expect(cancelled.body.order.status).toBe("cancelled");
    expect(cancelled.body.items[0].lots).toEqual([]);
    expect(cancelled.body.summary).toMatchObject({
      lots_count: 0,
      allocated_units: 0,
      pending_units: 3,
      ready: false,
    });

    const released = await readPicking(
      created.body.id,
      admin.token,
      "allocation_status=released",
    );

    expect(released.status).toBe(200);
    expect(released.body.items[0].lots).toEqual([
      expect.objectContaining({ quantity: 3, status: "released" }),
    ]);

    const all = await readPicking(
      created.body.id,
      admin.token,
      "allocation_status=all",
    );

    expect(all.status).toBe(200);
    expect(all.body.items[0].lots).toHaveLength(1);
    expect(all.body.summary.allocated_units).toBe(3);
  });
});
