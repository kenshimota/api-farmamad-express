jest.mock("../models/currency", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/currency-rate-history", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("../database", () => ({ transaction: jest.fn() }));

const db = require("../database");
const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const User = require("../models/user");
const {
  CHANGED_BY_ATTRIBUTES,
  HISTORY_ORDER,
  LIST_ORDER,
  createCurrencyRepository,
} = require("./repository");

const repository = createCurrencyRepository();
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const VALUES = {
  code: "EUR",
  name: "Euro",
  symbol: "€",
  rate: "970.500000",
  is_base: false,
  is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("currencyRepository", () => {
  it("runs the callback inside a transaction", async () => {
    db.transaction.mockImplementation((callback) => callback(TRANSACTION));

    await expect(
      repository.transaction(async (transaction) => transaction),
    ).resolves.toBe(TRANSACTION);
  });

  it("creates currencies and history rows with the transaction", async () => {
    const created = { id: 4, ...VALUES };
    const history = { id: 1 };
    Currency.create.mockResolvedValue(created);
    CurrencyRateHistory.create.mockResolvedValue(history);

    await expect(
      repository.create(VALUES, { transaction: TRANSACTION }),
    ).resolves.toBe(created);
    await expect(
      repository.createHistory(
        {
          currency_id: 4,
          previous_rate: null,
          new_rate: "970.500000",
          changed_by: 1,
          reason: null,
        },
        { transaction: TRANSACTION },
      ),
    ).resolves.toBe(history);

    expect(Currency.create).toHaveBeenCalledWith(VALUES, {
      transaction: TRANSACTION,
    });
    expect(CurrencyRateHistory.create).toHaveBeenCalledWith(
      {
        currency_id: 4,
        previous_rate: null,
        new_rate: "970.500000",
        changed_by: 1,
        reason: null,
      },
      { transaction: TRANSACTION },
    );
  });

  it("lists active currencies with the base first and then by code", async () => {
    Currency.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(Currency.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where: { is_active: true },
    });
    expect(LIST_ORDER).toEqual([
      ["is_base", "DESC"],
      ["code", "ASC"],
    ]);
  });

  it("lists inactive currencies on demand", async () => {
    Currency.findAll.mockResolvedValue([]);

    await repository.list({ includeInactive: true });

    expect(Currency.findAll).toHaveBeenCalledWith({ order: LIST_ORDER });
  });

  it("finds a currency by id with optional transaction and lock", async () => {
    const currency = { id: 1 };
    Currency.findByPk.mockResolvedValue(currency);

    await expect(repository.findById(1)).resolves.toBe(currency);
    expect(Currency.findByPk).toHaveBeenCalledWith(1, {
      transaction: undefined,
      lock: undefined,
    });

    await expect(repository.findByIdForUpdate(1, TRANSACTION)).resolves.toBe(
      currency,
    );
    expect(Currency.findByPk).toHaveBeenLastCalledWith(1, {
      transaction: TRANSACTION,
      lock: "UPDATE",
    });
  });

  it("updates the loaded instance with the transaction", async () => {
    const updated = { id: 1, rate: "1005.750000" };
    const currency = {
      id: 1,
      update: jest.fn().mockResolvedValue(updated),
    };

    await expect(
      repository.update(
        currency,
        { rate: "1005.750000" },
        {
          transaction: TRANSACTION,
        },
      ),
    ).resolves.toBe(updated);
    expect(currency.update).toHaveBeenCalledWith(
      { rate: "1005.750000" },
      { transaction: TRANSACTION },
    );
  });

  it("lists the history descending with the changed_by user", async () => {
    CurrencyRateHistory.findAll.mockResolvedValue([]);

    await expect(repository.listHistory(2)).resolves.toEqual([]);
    expect(CurrencyRateHistory.findAll).toHaveBeenCalledWith({
      where: { currency_id: 2 },
      order: HISTORY_ORDER,
      include: [
        {
          model: User,
          as: "changed_by_user",
          attributes: [...CHANGED_BY_ATTRIBUTES],
        },
      ],
    });
    expect(HISTORY_ORDER).toEqual([
      ["changed_at", "DESC"],
      ["id", "DESC"],
    ]);
    expect(CHANGED_BY_ATTRIBUTES).toEqual(["id", "username", "email"]);
  });

  it("uses injected models and database", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const historyModel = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    const userModel = { findByPk: jest.fn() };
    const injectedDb = { transaction: jest.fn() };
    const injected = createCurrencyRepository({
      model,
      historyModel,
      userModel,
      db: injectedDb,
    });

    await injected.create(VALUES);
    await injected.list();
    await injected.listHistory(1);

    expect(model.create).toHaveBeenCalledWith(VALUES, {
      transaction: undefined,
    });
    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      where: { is_active: true },
    });
    expect(historyModel.findAll).toHaveBeenCalledTimes(1);
    expect(Currency.create).not.toHaveBeenCalled();
  });
});
