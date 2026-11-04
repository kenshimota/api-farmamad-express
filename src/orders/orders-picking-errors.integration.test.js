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
 * @param {number|string} orderId - Order id.
 * @param {string} token - Bearer token.
 * @param {string} [query] - Raw query string without `?`.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function readPicking(orderId, token, query) {
  const suffix = query ? `?${query}` : "";

  return as("get", `/orders/${orderId}/picking${suffix}`, token);
}

describe("order picking access and validation", () => {
  it("allows internal roles and rejects customer, support and blocked users", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 1);
    const seller = await sessionFor("seller");
    const manager = await sessionFor("manager_warehouse");
    const dispatcher = await sessionFor("dispatcher");
    const support = await sessionFor("support");

    for (const token of [
      admin.token,
      seller.token,
      manager.token,
      dispatcher.token,
    ]) {
      const response = await readPicking(created.body.id, token);

      expect(response.status).toBe(200);
    }

    const customer = await readPicking(created.body.id, fixture.token);
    expect(customer.status).toBe(403);
    expect(customer.body).toEqual({ message: "Forbidden" });

    const supportResponse = await readPicking(created.body.id, support.token);
    expect(supportResponse.status).toBe(403);
    expect(supportResponse.body).toEqual({ message: "Forbidden" });

    const anonymous = await as("get", `/orders/${created.body.id}/picking`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    await admin.user.update({ isBlocked: true });
    const blocked = await readPicking(created.body.id, admin.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body).toEqual({ message: "User is blocked" });
  });

  it("validates the id and the allocation_status filter", async () => {
    const fixture = await createOrderFixture({ stock: 5 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 1);

    for (const id of ["abc", "0", "-2", "2.5"]) {
      const response = await readPicking(id, admin.token);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ errors: { id: "Invalid order id" } });
    }

    const invalidFilter = await readPicking(
      created.body.id,
      admin.token,
      "allocation_status=pending",
    );
    expect(invalidFilter.status).toBe(422);
    expect(invalidFilter.body).toEqual({
      errors: { allocation_status: "Invalid allocation_status" },
    });

    const missing = await readPicking(999999, admin.token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Order not found" });
  });

  it("loads the view in one query per table tree and never writes", async () => {
    const fixture = await createOrderFixture({ stock: 2, reserved: 1 });
    await createLot(fixture.product, fixture.itemState, fixture.location, {
      stock: 5,
      reserved: 0,
      expiration_date: "2027-01-15",
    });
    await fixture.stockRow.update({ quantity: 7 });
    const admin = await sessionFor("admin");
    const created = await createDraft(fixture, 6);

    await transition(created.body.id, "generate", admin.token);
    await fixture.lot.reload();
    const before = {
      reserved: fixture.lot.reserved,
      stock: fixture.lot.stock,
    };
    const queries = [];
    const originalLogging = sequelize.options.logging;
    sequelize.options.logging = (sql) => queries.push(sql);

    let response;
    try {
      response = await readPicking(created.body.id, admin.token);
    } finally {
      sequelize.options.logging = originalLogging;
    }

    expect(response.status).toBe(200);
    expect(response.body.items[0].lots).toHaveLength(2);
    expect(
      queries.filter((sql) => sql.includes("order_item_lot_allocations")),
    ).toHaveLength(1);

    await fixture.lot.reload();
    expect({
      reserved: fixture.lot.reserved,
      stock: fixture.lot.stock,
    }).toEqual(before);
  });
});
