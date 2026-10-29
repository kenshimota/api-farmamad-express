process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCost,
  createItemState,
  createProduct,
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

describe("GET /costs with a real database", () => {
  it("returns the costs ordered by product and item state", async () => {
    const firstProduct = await createProduct({ reference: "COST-A" });
    const secondProduct = await createProduct({ reference: "COST-B" });
    const sellable = await createItemState({
      name: "sellable",
      label: "Vendible",
    });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    const second = await createCost({
      product_id: secondProduct.id,
      item_state_id: sellable.id,
    });
    const last = await createCost({
      product_id: firstProduct.id,
      item_state_id: damaged.id,
    });
    const first = await createCost({
      product_id: firstProduct.id,
      item_state_id: sellable.id,
    });
    const token = await tokenFor("manager_warehouse");

    const response = await as("get", "/costs", token);

    expect(response.status).toBe(200);
    expect(response.body.map((cost) => cost.id)).toEqual([
      first.id,
      last.id,
      second.id,
    ]);
    expect(response.body.map((cost) => cost.cost)).toEqual([12.5, 12.5, 12.5]);
  });

  it("filters by product and item state", async () => {
    const product = await createProduct();
    const otherProduct = await createProduct({ reference: "COST-OTHER" });
    const sellable = await createItemState({
      name: "sellable",
      label: "Vendible",
    });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    await createCost({ product_id: product.id, item_state_id: sellable.id });
    await createCost({ product_id: product.id, item_state_id: damaged.id });
    await createCost({
      product_id: otherProduct.id,
      item_state_id: sellable.id,
    });
    const token = await tokenFor("seller");

    const byProduct = await as("get", `/costs?product_id=${product.id}`, token);
    expect(byProduct.status).toBe(200);
    expect(byProduct.body).toHaveLength(2);

    const byState = await as(
      "get",
      `/costs?item_state_id=${damaged.id}`,
      token,
    );
    expect(byState.status).toBe(200);
    expect(byState.body).toHaveLength(1);
    expect(byState.body[0].item_state.name).toBe("damaged");
  });

  it("responds 422 for invalid filters", async () => {
    const token = await tokenFor("admin");

    const product = await as("get", "/costs?product_id=abc", token);
    expect(product.status).toBe(422);
    expect(product.body).toEqual({
      errors: { product_id: "Invalid product id" },
    });

    const itemState = await as("get", "/costs?item_state_id=0", token);
    expect(itemState.status).toBe(422);
    expect(itemState.body).toEqual({
      errors: { item_state_id: "Invalid item state id" },
    });
  });

  it("returns an empty array when there are no costs", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/costs", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each(["admin", "seller", "manager_warehouse"])(
    "allows a %s to read the list",
    async (role) => {
      await createCost();
      const token = await tokenFor(role);

      const response = await as("get", "/costs", token);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    },
  );

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/costs", token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});
