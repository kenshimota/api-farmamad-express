process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createCost,
  createItemState,
  createProduct,
  createStock,
  publicItemState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/stocks");

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

describe("GET /stocks/available with a real database", () => {
  it("returns only sellable stock with quantity > 0, the current cost and name order", async () => {
    const product = await createProduct();
    const intact = await createItemState({
      name: "intact",
      label: "Intacto",
      is_sellable: true,
    });
    const sellable = await createItemState({
      name: "sellable",
      label: "Vendible",
      is_sellable: true,
    });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
      is_sellable: false,
    });
    await createStock({
      product_id: product.id,
      item_state_id: intact.id,
      quantity: 5,
    });
    await createStock({
      product_id: product.id,
      item_state_id: sellable.id,
      quantity: 40,
    });
    await createStock({
      product_id: product.id,
      item_state_id: damaged.id,
      quantity: 9,
    });
    await createCost({
      product_id: product.id,
      item_state_id: sellable.id,
      cost: 20,
    });
    const token = await tokenFor("manager_warehouse");

    const response = await as(
      "get",
      `/stocks/available?product_id=${product.id}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        product_id: product.id,
        item_state_id: intact.id,
        quantity: 5,
        cost: null,
        item_state: publicItemState(intact),
      },
      {
        product_id: product.id,
        item_state_id: sellable.id,
        quantity: 40,
        cost: 20,
        item_state: publicItemState(sellable),
      },
    ]);
  });

  it("excludes zero stock and supports the alias route", async () => {
    const product = await createProduct();
    const sellable = await createItemState();
    const stock = await createStock({
      product_id: product.id,
      item_state_id: sellable.id,
      quantity: 0,
    });
    const token = await tokenFor("seller");

    const empty = await as(
      "get",
      `/stocks/available?product_id=${product.id}`,
      token,
    );
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    await stock.update({ quantity: 3 });
    const alias = await as("get", `/stocks/available/${product.id}`, token);

    expect(alias.status).toBe(200);
    expect(alias.body).toHaveLength(1);
    expect(alias.body[0].quantity).toBe(3);
    expect(alias.body[0].cost).toBeNull();
  });

  it("returns [] for a product without available stock", async () => {
    const product = await createProduct();
    const token = await tokenFor("admin");

    const response = await as(
      "get",
      `/stocks/available?product_id=${product.id}`,
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 422, 401 and 403 for invalid requests", async () => {
    const token = await tokenFor("admin");

    const invalid = await as("get", "/stocks/available?product_id=abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { product_id: "Invalid id" },
    });

    const missing = await as("get", "/stocks/available", token);
    expect(missing.status).toBe(422);
    expect(missing.body).toEqual({
      errors: { product_id: "Invalid id" },
    });

    const anonymous = await request(app).get("/stocks/available?product_id=1");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await as(
      "get",
      "/stocks/available?product_id=1",
      dispatcher,
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
