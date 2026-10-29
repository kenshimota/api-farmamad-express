process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchase-item");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
const {
  as,
  createPurchase,
  createPurchaseItem,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/purchases");

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
 * Builds the product and item state references.
 * @returns {Promise<object>} Product and item state.
 */
async function references() {
  return {
    product: await createProduct({ reference: "ITEM-INT" }),
    itemState: await createItemState({
      name: "sellable",
      label: "Vendible",
      is_sellable: true,
    }),
  };
}

describe("line CRUD with a real database", () => {
  it("adds lines, recalculates the purchase and lists them", async () => {
    const purchase = await createPurchase();
    const { product, itemState } = await references();
    const token = await tokenFor("seller");

    const created = await as(
      "post",
      `/purchases/${purchase.id}/items`,
      token,
    ).send({
      product_id: product.id,
      item_state_id: itemState.id,
      quantity: 4,
      unit_cost: 25,
    });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        id: purchase.id,
        subtotal: 100,
        tax_amount: 16,
        total: 116,
      }),
    );
    expect(created.body.items).toEqual([
      expect.objectContaining({
        product_id: product.id,
        item_state_id: itemState.id,
        quantity: 4,
        unit_cost: 25,
        subtotal: 100,
      }),
    ]);

    const stored = await Purchase.findByPk(purchase.id);
    expect(Number(stored.total)).toBe(116);

    const list = await as(
      "get",
      `/purchases/${purchase.id}/items`,
      await tokenFor("manager_warehouse"),
    );
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty("createdAt");
  });

  it("updates a line and recalculates the totals", async () => {
    const purchase = await createPurchase();
    const item = await createPurchaseItem({
      purchase_id: purchase.id,
      quantity: 2,
      unit_cost: 10,
      subtotal: 20,
    });
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/purchases/${purchase.id}/items/${item.id}`,
      token,
    ).send({ quantity: 3, unit_cost: 12.5 });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        subtotal: 37.5,
        tax_amount: 6,
        total: 43.5,
      }),
    );
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        id: item.id,
        quantity: 3,
        unit_cost: 12.5,
        subtotal: 37.5,
      }),
    );
  });

  it("rejects duplicated pairs and non-existent references", async () => {
    const purchase = await createPurchase();
    const item = await createPurchaseItem({ purchase_id: purchase.id });
    const token = await tokenFor("admin");

    const duplicated = await as(
      "post",
      `/purchases/${purchase.id}/items`,
      token,
    ).send({
      product_id: item.product_id,
      item_state_id: item.item_state_id,
      quantity: 1,
      unit_cost: 1,
    });
    expect(duplicated.status).toBe(409);
    expect(duplicated.body).toEqual({ message: "Item already exists" });

    const missingProduct = await as(
      "post",
      `/purchases/${purchase.id}/items`,
      token,
    ).send({
      product_id: 99999,
      item_state_id: item.item_state_id,
      quantity: 1,
      unit_cost: 1,
    });
    expect(missingProduct.status).toBe(422);

    const missingState = await as(
      "post",
      `/purchases/${purchase.id}/items`,
      token,
    ).send({
      product_id: item.product_id,
      item_state_id: 99999,
      quantity: 1,
      unit_cost: 1,
    });
    expect(missingState.status).toBe(422);
  });

  it("rejects a line that belongs to another purchase and duplicated updates", async () => {
    const first = await createPurchase();
    const second = await createPurchase();
    const firstItem = await createPurchaseItem({ purchase_id: first.id });
    const secondItem = await createPurchaseItem({ purchase_id: second.id });
    const token = await tokenFor("admin");

    const wrongPurchase = await as(
      "put",
      `/purchases/${first.id}/items/${secondItem.id}`,
      token,
    ).send({ quantity: 2 });
    expect(wrongPurchase.status).toBe(404);
    expect(wrongPurchase.body).toEqual({ message: "Item not found" });

    const anotherLine = await createPurchaseItem({ purchase_id: first.id });
    const duplicate = await as(
      "put",
      `/purchases/${first.id}/items/${firstItem.id}`,
      token,
    ).send({
      product_id: anotherLine.product_id,
      item_state_id: anotherLine.item_state_id,
    });
    expect(duplicate.status).toBe(409);
  });

  it("deletes the last line and leaves every total at zero", async () => {
    const purchase = await createPurchase();
    const item = await createPurchaseItem({ purchase_id: purchase.id });
    const token = await tokenFor("seller");

    const response = await as(
      "delete",
      `/purchases/${purchase.id}/items/${item.id}`,
      token,
    );

    expect(response.status).toBe(204);
    const stored = await Purchase.findByPk(purchase.id);
    expect(Number(stored.subtotal)).toBe(0);
    expect(Number(stored.tax_amount)).toBe(0);
    expect(Number(stored.total)).toBe(0);
    expect(await PurchaseItem.count()).toBe(0);
  });

  it("responds 409 for lines of a non-draft and 403 for a read-only role", async () => {
    const confirmed = await createPurchase({
      status: "confirmed",
      confirmed_at: new Date(),
    });
    const item = await createPurchaseItem({ purchase_id: confirmed.id });
    const token = await tokenFor("admin");

    const read = await as("get", `/purchases/${confirmed.id}/items`, token);
    expect(read.status).toBe(409);

    const write = await as(
      "delete",
      `/purchases/${confirmed.id}/items/${item.id}`,
      token,
    );
    expect(write.status).toBe(409);

    const manager = await tokenFor("manager_warehouse");
    const forbidden = await as(
      "post",
      `/purchases/${confirmed.id}/items`,
      manager,
    ).send({
      product_id: item.product_id,
      item_state_id: item.item_state_id,
      quantity: 1,
      unit_cost: 1,
    });
    expect(forbidden.status).toBe(403);
  });

  it("responds 422 for invalid ids and 404 for missing purchases", async () => {
    const token = await tokenFor("admin");

    const invalidPurchase = await as("get", "/purchases/abc/items", token);
    expect(invalidPurchase.status).toBe(422);

    const missingPurchase = await as("get", "/purchases/99999/items", token);
    expect(missingPurchase.status).toBe(404);
    expect(missingPurchase.body).toEqual({ message: "Purchase not found" });

    const purchase = await createPurchase();
    const missingItem = await as(
      "delete",
      `/purchases/${purchase.id}/items/99999`,
      token,
    );
    expect(missingItem.status).toBe(404);
    expect(missingItem.body).toEqual({ message: "Item not found" });
  });
});
