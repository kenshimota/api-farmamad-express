process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  ensureDefaultTransactionCurrency,
  publicCurrencySummary,
} = require("../../test/helpers/currency-default");
const {
  BODY,
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

describe("POST /costs with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a cost and answers 201",
    async (role) => {
      const product = await createProduct();
      const itemState = await createItemState();
      const currency = await ensureDefaultTransactionCurrency();
      const token = await tokenFor(role);

      const response = await as("post", "/costs", token).send({
        product_id: product.id,
        item_state_id: itemState.id,
        cost: 12.5,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(Number),
        product_id: product.id,
        item_state_id: itemState.id,
        cost: 12.5,
        currency_id: currency.id,
        currency: publicCurrencySummary(currency),
        item_state: publicItemState(itemState),
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("allows the same product to have a cost per item state", async () => {
    const product = await createProduct();
    const sellable = await createItemState({ is_sellable: true });
    const damaged = await createItemState({
      name: "damaged",
      label: "Maltratado",
    });
    const token = await tokenFor("seller");

    const first = await as("post", "/costs", token).send({
      product_id: product.id,
      item_state_id: sellable.id,
      cost: 20,
    });
    const second = await as("post", "/costs", token).send({
      product_id: product.id,
      item_state_id: damaged.id,
      cost: 12.5,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.cost).toBe(20);
    expect(second.body.cost).toBe(12.5);
    expect(second.body.item_state.name).toBe("damaged");
  });

  it("responds 409 for a duplicated product and item state combination", async () => {
    const cost = await createCost();
    const token = await tokenFor("admin");

    const response = await as("post", "/costs", token).send({
      product_id: cost.product_id,
      item_state_id: cost.item_state_id,
      cost: 99,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Cost already exists" });
  });

  it("responds 422 for non-existent references", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const token = await tokenFor("admin");

    const missingProduct = await as("post", "/costs", token).send({
      product_id: 99999,
      item_state_id: itemState.id,
      cost: 10,
    });
    expect(missingProduct.status).toBe(422);
    expect(missingProduct.body).toEqual({
      errors: { product_id: "Invalid product" },
    });

    const missingItemState = await as("post", "/costs", token).send({
      product_id: product.id,
      item_state_id: 99999,
      cost: 10,
    });
    expect(missingItemState.status).toBe(422);
    expect(missingItemState.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
  });

  it("responds 422 for negative and imprecise amounts", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const token = await tokenFor("admin");
    const send = (cost) =>
      as("post", "/costs", token).send({
        product_id: product.id,
        item_state_id: itemState.id,
        cost,
      });

    const negative = await send(-1);
    expect(negative.status).toBe(422);
    expect(negative.body).toEqual({
      errors: { cost: "cost must be >= 0" },
    });

    const decimals = await send(12.345);
    expect(decimals.status).toBe(422);
    expect(decimals.body).toEqual({
      errors: { cost: "cost must have at most 2 decimals" },
    });

    const tooLarge = await send(1000000000);
    expect(tooLarge.status).toBe(422);
    expect(tooLarge.body).toEqual({
      errors: { cost: "cost must have at most 9 integer digits" },
    });
  });

  it("responds 400, 401 and 403 for invalid requests", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/costs", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "product_id, item_state_id and cost are required",
    });

    const anonymous = await request(app).post("/costs").send(BODY);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const dispatcher = await tokenFor("dispatcher");
    const forbidden = await as("post", "/costs", dispatcher).send(BODY);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("enforces uniqueness, the foreign keys and the non-negative check", async () => {
    const cost = await createCost();

    await expect(
      Cost.create({
        product_id: cost.product_id,
        item_state_id: cost.item_state_id,
        cost: 1,
        currency_id: cost.currency_id,
      }),
    ).rejects.toThrow(UniqueConstraintError);

    await expect(
      Cost.create({
        product_id: 99999,
        item_state_id: cost.item_state_id,
        cost: 1,
        currency_id: cost.currency_id,
      }),
    ).rejects.toThrow(ForeignKeyConstraintError);

    await expect(
      Cost.create({
        product_id: cost.product_id,
        item_state_id: cost.item_state_id,
        cost: -1,
        currency_id: cost.currency_id,
      }),
    ).rejects.toThrow();
  });

  it("rounds the decimal column to two places", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const currency = await ensureDefaultTransactionCurrency();

    const stored = await Cost.create({
      product_id: product.id,
      item_state_id: itemState.id,
      cost: 12.345,
      currency_id: currency.id,
    });

    expect(Number(stored.cost)).toBe(12.35);
  });
});
