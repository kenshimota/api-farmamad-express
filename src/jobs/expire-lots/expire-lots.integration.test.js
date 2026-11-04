process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../../database");
const Stock = require("../../models/stock");
const { assertTestDatabase } = require("../../../test/helpers/test-database");
const { truncateModels } = require("../../../test/helpers/database");
const {
  RESET_MODELS,
  createFixture,
  createLot,
  dateFromToday,
} = require("./expire-lots.integration-helpers");
const { createExpireLotsRepository } = require("./repository");
const { runExpireLotsJob } = require("./service");
const { stockRepository } = require("../../stocks/repository");
const { orderRepository } = require("../../orders/repository");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await truncateModels(RESET_MODELS);
});

afterAll(async () => {
  await truncateModels(RESET_MODELS);
  await sequelize.close();
});

describe("expire lots job with a real database", () => {
  it("moves only expired sellable lots without reservations and recalculates stocks", async () => {
    const { product, location, sellable, expired, damaged } =
      await createFixture();
    const repository = createExpireLotsRepository();
    const free = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-1),
      stock: 5,
    });
    const pending = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-3),
      stock: 2,
      locationStatus: "pending",
    });
    const reserved = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-2),
      stock: 4,
      reserved: 2,
    });
    const expiresToday = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(0),
      stock: 3,
    });
    const future = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(5),
      stock: 6,
    });
    const alreadyExpired = await createLot({
      product,
      itemState: expired,
      location,
      expirationDate: dateFromToday(-10),
      stock: 7,
    });
    const damagedLot = await createLot({
      product,
      itemState: damaged,
      location,
      expirationDate: dateFromToday(-4),
      stock: 8,
    });
    const sellableStock = await Stock.create({
      product_id: product.id,
      item_state_id: sellable.id,
      quantity: 999,
    });

    const summary = await runExpireLotsJob({ repository });

    expect(summary).toEqual(
      expect.objectContaining({
        candidates: 3,
        moved: 2,
        skipped_reserved: [
          {
            lot_id: reserved.id,
            number: reserved.number,
            expiration_date: dateFromToday(-2),
            reserved: 2,
          },
        ],
        affected_products: 1,
        stock_rows_updated: 2,
        expired_item_state_id: expired.id,
        locked: true,
        dry_run: false,
        errors: [],
      }),
    );

    await free.reload();
    await pending.reload();
    await reserved.reload();
    await expiresToday.reload();
    await future.reload();
    await alreadyExpired.reload();
    await damagedLot.reload();
    await sellableStock.reload();

    expect(free.item_state_id).toBe(expired.id);
    expect(free.stock).toBe(5);
    expect(free.reserved).toBe(0);
    expect(free.location_status).toBe("located");
    expect(free.warehouse_id).toBe(location.warehouse.id);
    expect(pending.item_state_id).toBe(expired.id);
    expect(pending.location_status).toBe("pending");
    expect(pending.warehouse_id).toBeNull();
    expect(reserved.item_state_id).toBe(sellable.id);
    expect(reserved.reserved).toBe(2);
    expect(expiresToday.item_state_id).toBe(sellable.id);
    expect(future.item_state_id).toBe(sellable.id);
    expect(alreadyExpired.item_state_id).toBe(expired.id);
    expect(damagedLot.item_state_id).toBe(damaged.id);

    expect(sellableStock.quantity).toBe(13);

    const expiredStock = await Stock.findOne({
      where: { product_id: product.id, item_state_id: expired.id },
    });
    const damagedStock = await Stock.findOne({
      where: { product_id: product.id, item_state_id: damaged.id },
    });

    expect(expiredStock.quantity).toBe(14);
    expect(damagedStock).toBeNull();
  });

  it("is idempotent when executed twice", async () => {
    const { product, location, sellable, expired } = await createFixture();
    const repository = createExpireLotsRepository();
    const lot = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-1),
      stock: 5,
    });

    const first = await runExpireLotsJob({ repository });
    const stock = await Stock.findOne({
      where: { product_id: product.id, item_state_id: expired.id },
    });
    const firstStockUpdatedAt = stock.updatedAt.getTime();
    await lot.reload();
    const firstLotUpdatedAt = lot.updatedAt.getTime();

    const second = await runExpireLotsJob({ repository });

    expect(first.moved).toBe(1);
    expect(second).toEqual(
      expect.objectContaining({
        candidates: 0,
        moved: 0,
        skipped_reserved: [],
        stock_rows_updated: 0,
        locked: true,
      }),
    );

    await stock.reload();
    await lot.reload();

    expect(stock.quantity).toBe(5);
    expect(stock.updatedAt.getTime()).toBe(firstStockUpdatedAt);
    expect(lot.item_state_id).toBe(expired.id);
    expect(lot.updatedAt.getTime()).toBe(firstLotUpdatedAt);
  });

  it("does not persist anything in dry-run mode", async () => {
    const { product, location, sellable, expired } = await createFixture();
    const repository = createExpireLotsRepository();
    const lot = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-1),
      stock: 5,
    });
    const sellableStock = await Stock.create({
      product_id: product.id,
      item_state_id: sellable.id,
      quantity: 10,
    });

    const summary = await runExpireLotsJob({
      repository,
      dryRun: true,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        candidates: 1,
        moved: 1,
        stock_rows_updated: 0,
        dry_run: true,
        locked: true,
      }),
    );

    await lot.reload();
    await sellableStock.reload();

    expect(lot.item_state_id).toBe(sellable.id);
    expect(sellableStock.quantity).toBe(10);
    await expect(
      Stock.findOne({
        where: { product_id: product.id, item_state_id: expired.id },
      }),
    ).resolves.toBeNull();
  });

  it("excludes expired lots from located quantities and reservations", async () => {
    const { product, location, sellable } = await createFixture();
    await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-1),
      stock: 5,
    });

    const located = await stockRepository.getLocatedQuantities(product.id);
    const reservable = await orderRepository.transaction((transaction) =>
      orderRepository.findLotsForUpdate(product.id, sellable.id, transaction),
    );

    expect(located.get(sellable.id)).toBeUndefined();
    expect(reservable).toEqual([]);
  });
});
