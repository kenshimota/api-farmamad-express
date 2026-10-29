process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const Stock = require("../models/stock");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
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

describe("GET /stocks with a real database", () => {
  it("returns the inventory with the nested item state and filters", async () => {
    const product = await createProduct();
    const sellable = await createItemState();
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
      is_sellable: false,
    });
    const available = await createStock({
      product_id: product.id,
      item_state_id: sellable.id,
      quantity: 40,
    });
    const empty = await createStock({
      product_id: product.id,
      item_state_id: damaged.id,
      quantity: 0,
    });
    const token = await tokenFor("manager_warehouse");

    const all = await as("get", "/stocks", token);
    expect(all.status).toBe(200);
    expect(all.body).toEqual([
      {
        id: available.id,
        product_id: product.id,
        item_state_id: sellable.id,
        quantity: 40,
        item_state: publicItemState(sellable),
      },
      {
        id: empty.id,
        product_id: product.id,
        item_state_id: damaged.id,
        quantity: 0,
        item_state: publicItemState(damaged),
      },
    ]);
    expect(all.body[0]).not.toHaveProperty("createdAt");
    expect(all.body[0]).not.toHaveProperty("updatedAt");

    const inStock = await as("get", "/stocks?in_stock=true", token);
    expect(inStock.status).toBe(200);
    expect(inStock.body.map((row) => row.id)).toEqual([available.id]);

    const byState = await as(
      "get",
      `/stocks?item_state_id=${damaged.id}`,
      token,
    );
    expect(byState.status).toBe(200);
    expect(byState.body.map((row) => row.id)).toEqual([empty.id]);
  });

  it("returns one stock and the stocks of a product", async () => {
    const stock = await createStock();
    const token = await tokenFor("admin");

    const detail = await as("get", `/stocks/${stock.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(
      expect.objectContaining({
        id: stock.id,
        product_id: stock.product_id,
        item_state_id: stock.item_state_id,
        quantity: 10,
      }),
    );

    const list = await as("get", `/stocks/product/${stock.product_id}`, token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(stock.id);
  });

  it("returns [] for a product without stock", async () => {
    const product = await createProduct();
    const token = await tokenFor("seller");

    const response = await as("get", `/stocks/product/${product.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 404, 422, 401 and 403 for invalid requests", async () => {
    const stock = await createStock();
    const token = await tokenFor("admin");

    const missing = await as("get", "/stocks/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Stock not found" });

    const invalidId = await as("get", "/stocks/abc", token);
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({ errors: { id: "Invalid stock id" } });

    const invalidFilter = await as("get", "/stocks?product_id=abc", token);
    expect(invalidFilter.status).toBe(422);
    expect(invalidFilter.body).toEqual({
      errors: { product_id: "Invalid id" },
    });

    const anonymous = await request(app).get("/stocks");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await as("get", "/stocks", dispatcher);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });

    expect(stock.id).toBeDefined();
  });

  it.each(["dispatcher", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("get", "/stocks", token);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("does not expose public write endpoints", async () => {
    const token = await tokenFor("admin");
    const stock = await createStock();

    for (const method of ["post", "put", "delete"]) {
      const response = await as(method, `/stocks/${stock.id}`, token).send({
        quantity: 1,
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Not found" });
    }
  });
});

describe("stock integrity with a real database", () => {
  it("enforces the unique combination, the foreign keys and the check", async () => {
    const stock = await createStock();

    await expect(
      Stock.create({
        product_id: stock.product_id,
        item_state_id: stock.item_state_id,
        quantity: 1,
      }),
    ).rejects.toThrow(UniqueConstraintError);

    await expect(
      Stock.create({
        product_id: 99999,
        item_state_id: stock.item_state_id,
        quantity: 1,
      }),
    ).rejects.toThrow(ForeignKeyConstraintError);

    await expect(
      Stock.create({
        product_id: stock.product_id,
        item_state_id: stock.item_state_id,
        quantity: -1,
      }),
    ).rejects.toThrow();
  });

  it("responds 409 when a stock references the product or the item state", async () => {
    const stock = await createStock();
    const token = await tokenFor("admin");

    const product = await as("delete", `/products/${stock.product_id}`, token);
    expect(product.status).toBe(409);
    expect(product.body).toEqual({ message: "Product is in use" });

    const itemState = await as(
      "delete",
      `/item-states/${stock.item_state_id}`,
      token,
    );
    expect(itemState.status).toBe(409);
    expect(itemState.body).toEqual({ message: "Item state is in use" });

    await expect(Product.findByPk(stock.product_id)).resolves.not.toBeNull();
  });

  it("responds 409 when renaming an item state referenced by a stock", async () => {
    const stock = await createStock();
    const token = await tokenFor("admin");

    const response = await as(
      "put",
      `/item-states/${stock.item_state_id}`,
      token,
    ).send({ name: "available" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state is in use" });
    await expect(
      ItemState.findByPk(stock.item_state_id),
    ).resolves.toMatchObject({ name: "sellable" });
  });
});
