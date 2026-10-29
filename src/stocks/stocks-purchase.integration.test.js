process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Stock = require("../models/stock");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { stockRepository } = require("./repository");
const {
  createItemState,
  createProduct,
  createStock,
  resetDatabase,
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

describe("applyPurchaseItems with a real database", () => {
  it("creates the stock row when it does not exist", async () => {
    const product = await createProduct();
    const itemState = await createItemState();

    await sequelize.transaction((transaction) =>
      stockRepository.applyPurchaseItems(
        [
          {
            product_id: product.id,
            item_state_id: itemState.id,
            quantity: 7,
          },
        ],
        { transaction },
      ),
    );

    const stored = await Stock.findOne({
      where: { product_id: product.id, item_state_id: itemState.id },
    });
    expect(stored.quantity).toBe(7);
  });

  it("increments an existing row and aggregates duplicated pairs", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    await createStock({
      product_id: product.id,
      item_state_id: itemState.id,
      quantity: 5,
    });

    await sequelize.transaction((transaction) =>
      stockRepository.applyPurchaseItems(
        [
          {
            product_id: product.id,
            item_state_id: itemState.id,
            quantity: 3,
          },
          {
            product_id: product.id,
            item_state_id: itemState.id,
            quantity: 2,
          },
        ],
        { transaction },
      ),
    );

    const stored = await Stock.findOne({
      where: { product_id: product.id, item_state_id: itemState.id },
    });
    expect(stored.quantity).toBe(10);
  });

  it("rolls back every stock change when one item fails", async () => {
    const product = await createProduct();
    const itemState = await createItemState();

    await expect(
      sequelize.transaction((transaction) =>
        stockRepository.applyPurchaseItems(
          [
            {
              product_id: product.id,
              item_state_id: itemState.id,
              quantity: 4,
            },
            {
              product_id: 99999,
              item_state_id: itemState.id,
              quantity: 1,
            },
          ],
          { transaction },
        ),
      ),
    ).rejects.toThrow();

    expect(await Stock.count()).toBe(0);
  });

  it("keeps concurrent purchases consistent with atomic increments", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    await createStock({
      product_id: product.id,
      item_state_id: itemState.id,
      quantity: 0,
    });
    const purchases = Array.from({ length: 8 }, () =>
      sequelize.transaction((transaction) =>
        stockRepository.applyPurchaseItems(
          [
            {
              product_id: product.id,
              item_state_id: itemState.id,
              quantity: 1,
            },
          ],
          { transaction },
        ),
      ),
    );

    await Promise.all(purchases);

    const stored = await Stock.findOne({
      where: { product_id: product.id, item_state_id: itemState.id },
    });
    expect(stored.quantity).toBe(8);
  });

  it("creates a single row under concurrent confirmations", async () => {
    const product = await createProduct();
    const itemState = await createItemState();
    const purchases = Array.from({ length: 8 }, () =>
      sequelize.transaction((transaction) =>
        stockRepository.applyPurchaseItems(
          [
            {
              product_id: product.id,
              item_state_id: itemState.id,
              quantity: 1,
            },
          ],
          { transaction },
        ),
      ),
    );

    await Promise.all(purchases);

    const rows = await Stock.findAll({
      where: { product_id: product.id, item_state_id: itemState.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(8);
  });
});
