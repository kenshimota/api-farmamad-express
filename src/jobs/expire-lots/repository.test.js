jest.mock("../../database", () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));
jest.mock("../../models/lot", () => ({
  findAll: jest.fn(),
  sum: jest.fn(),
  count: jest.fn(),
}));
jest.mock("../../models/item-state", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../../models/stock", () => ({
  findOrCreate: jest.fn(),
}));

const { Op } = require("sequelize");
const db = require("../../database");
const Lot = require("../../models/lot");
const ItemState = require("../../models/item-state");
const Stock = require("../../models/stock");
const {
  ADVISORY_LOCK_KEY,
  createExpireLotsRepository,
} = require("./repository");

const TRANSACTION = Object.freeze({ LOCK: { UPDATE: "UPDATE" }, id: "tx" });

/**
 * Builds a repository with the mocked models.
 * @returns {object} The repository.
 */
function buildRepository() {
  return createExpireLotsRepository({
    model: Lot,
    itemStateModel: ItemState,
    stockModel: Stock,
    db,
  });
}

beforeEach(() => {
  db.query.mockReset();
  db.transaction.mockReset();
  Lot.findAll.mockReset();
  Lot.sum.mockReset();
  ItemState.findOne.mockReset();
  ItemState.findAll.mockReset();
  Stock.findOrCreate.mockReset();
});

describe("expire lots repository", () => {
  it("exposes the documented advisory lock key", () => {
    expect(ADVISORY_LOCK_KEY).toBe(49050);
  });

  it("delegates the transaction to Sequelize", async () => {
    const repository = buildRepository();
    const callback = jest.fn().mockResolvedValue("done");

    db.transaction.mockImplementation((inner) => inner(TRANSACTION));

    await expect(repository.transaction(callback)).resolves.toBe("done");
    expect(db.transaction).toHaveBeenCalledWith(callback);
  });

  it("acquires the transaction advisory lock with a replacement", async () => {
    const repository = buildRepository();
    db.query.mockResolvedValue([{ locked: true }]);

    await expect(repository.tryAdvisoryLock(TRANSACTION)).resolves.toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_xact_lock(:key) AS "locked"',
      {
        replacements: { key: ADVISORY_LOCK_KEY },
        type: expect.any(String),
        transaction: TRANSACTION,
      },
    );
  });

  it("returns false when the advisory lock is already held", async () => {
    const repository = buildRepository();
    db.query.mockResolvedValue([{ locked: false }]);

    await expect(repository.tryAdvisoryLock(TRANSACTION)).resolves.toBe(false);
  });

  it("returns false when PostgreSQL does not return a row", async () => {
    const repository = buildRepository();
    db.query.mockResolvedValue([]);

    await expect(repository.tryAdvisoryLock(TRANSACTION)).resolves.toBe(false);
  });

  it("finds the expired item state by its stable name", async () => {
    const repository = buildRepository();
    const expired = { id: 3, name: "expired" };
    ItemState.findOne.mockResolvedValue(expired);

    await expect(repository.findExpiredItemState(TRANSACTION)).resolves.toBe(
      expired,
    );
    expect(ItemState.findOne).toHaveBeenCalledWith({
      where: { name: "expired" },
      transaction: TRANSACTION,
    });
  });

  it("loads the sellable item state ids as numbers", async () => {
    const repository = buildRepository();
    ItemState.findAll.mockResolvedValue([{ id: 1 }, { id: "2" }]);

    await expect(repository.findSellableStateIds(TRANSACTION)).resolves.toEqual(
      [1, 2],
    );
    expect(ItemState.findAll).toHaveBeenCalledWith({
      attributes: ["id"],
      where: { is_sellable: true },
      raw: true,
      transaction: TRANSACTION,
    });
  });

  it("selects expired candidates ordered FEFO with a row lock", async () => {
    const repository = buildRepository();
    Lot.findAll.mockResolvedValue([]);

    await expect(
      repository.findCandidates({
        sellableStateIds: [1, 2],
        limit: 500,
        transaction: TRANSACTION,
      }),
    ).resolves.toEqual([]);

    const [options] = Lot.findAll.mock.calls[0];

    expect(options.where.item_state_id).toEqual({ [Op.in]: [1, 2] });
    expect(options.where.expiration_date[Op.lt].val).toBe("CURRENT_DATE");
    expect(options.order).toEqual([
      ["expiration_date", "ASC"],
      ["id", "ASC"],
    ]);
    expect(options.limit).toBe(500);
    expect(options.lock).toBe("UPDATE");
    expect(options.transaction).toBe(TRANSACTION);
  });

  it("continues after the last processed lot with a keyset cursor", async () => {
    const repository = buildRepository();
    Lot.findAll.mockResolvedValue([]);

    await repository.findCandidates({
      sellableStateIds: [1],
      after: { expirationDate: "2026-01-31", id: 12 },
      limit: 10,
      transaction: TRANSACTION,
    });

    const [options] = Lot.findAll.mock.calls[0];

    expect(options.where[Op.and]).toEqual([
      {
        [Op.or]: [
          { expiration_date: { [Op.gt]: "2026-01-31" } },
          { expiration_date: "2026-01-31", id: { [Op.gt]: 12 } },
        ],
      },
    ]);
  });

  it("skips the candidate query when there is no sellable state", async () => {
    const repository = buildRepository();

    await expect(
      repository.findCandidates({
        sellableStateIds: [],
        limit: 500,
        transaction: TRANSACTION,
      }),
    ).resolves.toEqual([]);
    expect(Lot.findAll).not.toHaveBeenCalled();
  });

  it("moves a lot to the expired state", async () => {
    const repository = buildRepository();
    const lot = { id: 9, update: jest.fn().mockResolvedValue("lot") };

    await expect(repository.moveToExpired(lot, 3, TRANSACTION)).resolves.toBe(
      "lot",
    );
    expect(lot.update).toHaveBeenCalledWith(
      { item_state_id: 3 },
      { transaction: TRANSACTION },
    );
  });

  it("recalculates stocks with SUM(lots.stock) and creates the missing row", async () => {
    const repository = buildRepository();
    const update = jest.fn();
    Lot.sum.mockResolvedValue("13");
    Stock.findOrCreate.mockResolvedValue([{ quantity: 0, update }, true]);

    await expect(repository.recalculateStock(15, 3, TRANSACTION)).resolves.toBe(
      1,
    );

    expect(Lot.sum).toHaveBeenCalledWith("stock", {
      where: { product_id: 15, item_state_id: 3 },
      transaction: TRANSACTION,
    });
    expect(Stock.findOrCreate).toHaveBeenCalledWith({
      where: { product_id: 15, item_state_id: 3 },
      defaults: { quantity: 13 },
      transaction: TRANSACTION,
      lock: "UPDATE",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates the existing stock row when the total changed", async () => {
    const repository = buildRepository();
    const update = jest.fn().mockResolvedValue();
    Lot.sum.mockResolvedValue(4);
    Stock.findOrCreate.mockResolvedValue([{ quantity: 9, update }, false]);

    await expect(repository.recalculateStock(15, 1, TRANSACTION)).resolves.toBe(
      1,
    );

    expect(update).toHaveBeenCalledWith(
      { quantity: 4 },
      { transaction: TRANSACTION },
    );
  });

  it("does not write a stock row when the total is already correct", async () => {
    const repository = buildRepository();
    const update = jest.fn();
    Lot.sum.mockResolvedValue(null);
    Stock.findOrCreate.mockResolvedValue([{ quantity: 0, update }, false]);

    await expect(repository.recalculateStock(15, 1, TRANSACTION)).resolves.toBe(
      0,
    );

    expect(Stock.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ defaults: { quantity: 0 } }),
    );
    expect(update).not.toHaveBeenCalled();
  });
});
