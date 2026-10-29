process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Cost = require("../models/cost");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCost,
  createItemState,
  createProduct,
  publicItemState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/costs");

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

describe("GET /costs/:id and /costs/product/:product_id with a real database", () => {
  it("returns the detail and the costs of one product", async () => {
    const product = await createProduct();
    const sellable = await createItemState({
      name: "sellable",
      label: "Vendible",
    });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    const cost = await createCost({
      product_id: product.id,
      item_state_id: sellable.id,
    });
    await createCost({ product_id: product.id, item_state_id: damaged.id });
    const token = await tokenFor("manager_warehouse");

    const detail = await as("get", `/costs/${cost.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({
      id: cost.id,
      product_id: product.id,
      item_state_id: sellable.id,
      cost: 12.5,
      currency_id: expect.any(Number),
      currency: expect.objectContaining({ code: "USD_BCV" }),
      item_state: publicItemState(sellable),
    });

    const list = await as("get", `/costs/product/${product.id}`, token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((row) => row.item_state_id)).toEqual([
      sellable.id,
      damaged.id,
    ]);
  });

  it("returns [] when the product has no costs", async () => {
    const product = await createProduct();
    const token = await tokenFor("admin");

    const response = await as("get", `/costs/product/${product.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/costs/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Cost not found" });

    const invalid = await as("get", "/costs/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid cost id" },
    });

    const invalidProduct = await as("get", "/costs/product/abc", token);
    expect(invalidProduct.status).toBe(422);
    expect(invalidProduct.body).toEqual({
      errors: { product_id: "Invalid product id" },
    });
  });
});

describe("PUT /costs/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the cost and answers 202",
    async (role) => {
      const cost = await createCost();
      const token = await tokenFor(role);

      const response = await as("put", `/costs/${cost.id}`, token).send({
        cost: 20,
      });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: cost.id,
        product_id: cost.product_id,
        item_state_id: cost.item_state_id,
        cost: 20,
        currency_id: expect.any(Number),
        currency: expect.objectContaining({ code: "USD_BCV" }),
        item_state: expect.objectContaining({
          id: cost.item_state_id,
          is_sellable: true,
        }),
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Cost.findByPk(cost.id);
      expect(Number(stored.cost)).toBe(20);
    },
  );

  it("updates the product and item state of the cost", async () => {
    const cost = await createCost();
    const product = await createProduct({ reference: "COST-MOVED" });
    const itemState = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    const token = await tokenFor("seller");

    const response = await as("put", `/costs/${cost.id}`, token).send({
      product_id: product.id,
      item_state_id: itemState.id,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: cost.id,
        product_id: product.id,
        item_state_id: itemState.id,
        item_state: publicItemState(itemState),
      }),
    );
  });

  it("responds 409 when the new combination already exists", async () => {
    const product = await createProduct();
    const sellable = await createItemState({
      name: "sellable",
      label: "Vendible",
    });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    await createCost({ product_id: product.id, item_state_id: sellable.id });
    const second = await createCost({
      product_id: product.id,
      item_state_id: damaged.id,
    });
    const token = await tokenFor("admin");

    const response = await as("put", `/costs/${second.id}`, token).send({
      item_state_id: sellable.id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Cost already exists" });
  });

  it("responds 422 for non-existent references and invalid amounts", async () => {
    const cost = await createCost();
    const token = await tokenFor("admin");

    const missingProduct = await as("put", `/costs/${cost.id}`, token).send({
      product_id: 99999,
    });
    expect(missingProduct.status).toBe(422);
    expect(missingProduct.body).toEqual({
      errors: { product_id: "Invalid product" },
    });

    const missingState = await as("put", `/costs/${cost.id}`, token).send({
      item_state_id: 99999,
    });
    expect(missingState.status).toBe(422);
    expect(missingState.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });

    const negative = await as("put", `/costs/${cost.id}`, token).send({
      cost: -1,
    });
    expect(negative.status).toBe(422);
    expect(negative.body).toEqual({
      errors: { cost: "cost must be >= 0" },
    });
  });

  it("responds 400, 401, 403, 404 and 422 for invalid requests", async () => {
    const cost = await createCost();
    const token = await tokenFor("admin");

    const empty = await as("put", `/costs/${cost.id}`, token).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "at least one field is required",
    });

    const anonymous = await request(app)
      .put(`/costs/${cost.id}`)
      .send({ cost: 10 });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const manager = await tokenFor("manager_warehouse");
    const forbidden = await as("put", `/costs/${cost.id}`, manager).send({
      cost: 10,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });

    const missing = await as("put", "/costs/99999", token).send({ cost: 10 });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Cost not found" });

    const invalidId = await as("put", "/costs/abc", token).send({ cost: 10 });
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({
      errors: { id: "Invalid cost id" },
    });
  });
});

describe("DELETE /costs/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete a cost and answers 204",
    async (role) => {
      const cost = await createCost();
      const token = await tokenFor(role);

      const response = await as("delete", `/costs/${cost.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(Cost.findByPk(cost.id)).resolves.toBeNull();
    },
  );

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/costs/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Cost not found" });

    const invalid = await as("delete", "/costs/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid cost id" },
    });
  });

  it("keeps a product in use by a cost from being deleted", async () => {
    const cost = await createCost();
    const token = await tokenFor("admin");

    const response = await as("delete", `/products/${cost.product_id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Product is in use" });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const cost = await createCost();

    const anonymous = await request(app).delete(`/costs/${cost.id}`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await as("delete", `/costs/${cost.id}`, dispatcher);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
