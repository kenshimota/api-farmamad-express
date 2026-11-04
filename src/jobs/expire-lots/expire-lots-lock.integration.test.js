process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { QueryTypes } = require("sequelize");
const sequelize = require("../../database");
const { assertTestDatabase } = require("../../../test/helpers/test-database");
const { truncateModels } = require("../../../test/helpers/database");
const { createProduct } = require("../../../test/helpers/products");
const {
  RESET_MODELS,
  createFixture,
  createLocation,
  createLot,
  createState,
  dateFromToday,
} = require("./expire-lots.integration-helpers");
const {
  ADVISORY_LOCK_KEY,
  createExpireLotsRepository,
} = require("./repository");
const { ExpiredItemStateNotFoundError } = require("./errors");
const { runExpireLotsJob } = require("./service");

const SILENT_LOGGER = Object.freeze({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

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

describe("expire lots job lock and safety with a real database", () => {
  it("skips the run when another transaction holds the advisory lock", async () => {
    const { product, location, sellable, expired } = await createFixture();
    const repository = createExpireLotsRepository();
    const lot = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-1),
      stock: 5,
    });
    const external = await sequelize.transaction();

    try {
      const [lock] = await sequelize.query(
        'SELECT pg_try_advisory_xact_lock(:key) AS "locked"',
        {
          replacements: { key: ADVISORY_LOCK_KEY },
          type: QueryTypes.SELECT,
          transaction: external,
        },
      );

      expect(lock.locked).toBe(true);

      const summary = await runExpireLotsJob({
        repository,
        logger: SILENT_LOGGER,
      });

      expect(summary.locked).toBe(false);
      expect(summary.moved).toBe(0);
      await lot.reload();
      expect(lot.item_state_id).toBe(sellable.id);
    } finally {
      await external.rollback();
    }

    expect(expired.id).toEqual(expect.any(Number));
  });

  it("fails without changing lots when the expired state does not exist", async () => {
    const product = await createProduct({
      reference: `JOB-${Math.random().toString(36).slice(2, 8)}`,
    });
    const location = await createLocation();
    const sellable = await createState("sellable", true);
    const repository = createExpireLotsRepository();
    const lot = await createLot({
      product,
      itemState: sellable,
      location,
      expirationDate: dateFromToday(-1),
      stock: 5,
    });

    await expect(
      runExpireLotsJob({ repository, logger: SILENT_LOGGER }),
    ).rejects.toBeInstanceOf(ExpiredItemStateNotFoundError);

    await lot.reload();
    expect(lot.item_state_id).toBe(sellable.id);
  });
});
