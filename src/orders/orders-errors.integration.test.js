process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createOrderFixture } = require("../../test/helpers/order-lifecycle");
const {
  as,
  createCost,
  createItemState,
  createProduct,
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
function lineFor(fixture, quantity = 1) {
  return {
    product_id: fixture.product.id,
    item_state_id: fixture.itemState.id,
    quantity,
  };
}

describe("order lifecycle errors with a real database", () => {
  it("responds 401 without token and 403 for roles outside orders", async () => {
    const anonymous = await request(app).post("/orders").send({});
    expect(anonymous.status).toBe(401);

    const dispatcher = await sessionFor("dispatcher");
    const forbidden = await as("post", "/orders", dispatcher.token).send({});
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("rejects an unknown or non-sellable item state with 422", async () => {
    const fixture = await createOrderFixture();
    const nonSellable = await createItemState({ is_sellable: false });

    const unknown = await as("post", "/orders", fixture.token).send({
      items: [{ ...lineFor(fixture), item_state_id: 999999 }],
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });

    const refused = await as("post", "/orders", fixture.token).send({
      items: [
        {
          product_id: fixture.product.id,
          item_state_id: nonSellable.id,
          quantity: 1,
        },
      ],
    });
    expect(refused.status).toBe(422);
    expect(refused.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
  });

  it("rejects a product without price for the list and item state", async () => {
    const fixture = await createOrderFixture();
    const product = await createProduct();
    const itemState = await createItemState();

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        { product_id: product.id, item_state_id: itemState.id, quantity: 1 },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: {
        product_id: "Product has no price for this item state and price list",
      },
    });
  });

  it("allows the same product in different item states with different prices", async () => {
    const fixture = await createOrderFixture();
    const secondState = await createItemState();
    await createCost(fixture.product, secondState, { cost: "20.00" });

    const response = await as("post", "/orders", fixture.token).send({
      items: [
        lineFor(fixture, 2),
        {
          product_id: fixture.product.id,
          item_state_id: secondState.id,
          quantity: 1,
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].unit_price).toBe(14.29);
    expect(response.body.items[1].unit_price).toBe(28.57);
  });

  it("rejects duplicated product and state pairs with 409", async () => {
    const fixture = await createOrderFixture();

    const response = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture), lineFor(fixture)],
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Product and item state already in order",
    });
  });

  it("hides other customers' orders and blocks item edits after request", async () => {
    const first = await createOrderFixture();
    const second = await createOrderFixture();

    const created = await as("post", "/orders", first.token).send({
      items: [lineFor(first)],
    });

    const hidden = await as("get", `/orders/${created.body.id}`, second.token);
    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual({ message: "Order not found" });

    const requested = await as(
      "put",
      `/orders/${created.body.id}/status`,
      first.token,
    ).send({ status: "request" });
    expect(requested.status).toBe(202);

    const edit = await as(
      "post",
      `/orders/${created.body.id}/items`,
      first.token,
    ).send(lineFor(first));
    expect(edit.status).toBe(422);
    expect(edit.body).toEqual({
      errors: { status: "Order is not editable" },
    });
  });

  it("forbids customers from generating and hides unassigned seller writes", async () => {
    const fixture = await createOrderFixture();
    const admin = await sessionFor("admin");
    const seller = await sessionFor("seller");

    const created = await as("post", "/orders", fixture.token).send({
      items: [lineFor(fixture)],
    });

    const customerGenerate = await as(
      "put",
      `/orders/${created.body.id}/status`,
      fixture.token,
    ).send({ status: "generate" });
    expect(customerGenerate.status).toBe(403);

    const sellerEdit = await as(
      "put",
      `/orders/${created.body.id}/status`,
      seller.token,
    ).send({ status: "generate" });
    expect(sellerEdit.status).toBe(404);

    const adminEdit = await as(
      "put",
      `/orders/${created.body.id}/status`,
      admin.token,
    ).send({ status: "cancelled" });
    expect(adminEdit.status).toBe(202);
  });
});
