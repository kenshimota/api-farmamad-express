jest.mock("../models/currency", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/currency-rate-history", () => ({ findOne: jest.fn() }));
jest.mock("../models/order", () => ({ findByPk: jest.fn() }));

const Currency = require("../models/currency");
const CurrencyRateHistory = require("../models/currency-rate-history");
const Order = require("../models/order");
const { createDocumentRepository } = require("./repository");

const repository = createDocumentRepository();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("document repository", () => {
  it("loads a currency by primary key", async () => {
    Currency.findByPk.mockResolvedValue({ id: 3 });

    await expect(repository.findCurrencyById(3)).resolves.toEqual({ id: 3 });
    expect(Currency.findByPk).toHaveBeenCalledWith(3);
  });

  it("loads the base currency", async () => {
    Currency.findOne.mockResolvedValue({ id: 1, is_base: true });

    await expect(repository.findBaseCurrency()).resolves.toEqual({
      id: 1,
      is_base: true,
    });
    expect(Currency.findOne).toHaveBeenCalledWith({
      where: { is_base: true },
    });
  });

  it("loads the newest rate change of a currency", async () => {
    const changedAt = new Date("2026-11-01T10:00:00.000Z");
    CurrencyRateHistory.findOne.mockResolvedValue({ changed_at: changedAt });

    await expect(repository.findLatestRateChange(3)).resolves.toEqual({
      changed_at: changedAt,
    });
    expect(CurrencyRateHistory.findOne).toHaveBeenCalledWith({
      where: { currency_id: 3 },
      order: [
        ["changed_at", "DESC"],
        ["id", "DESC"],
      ],
      attributes: ["changed_at"],
    });
  });

  it("loads only the number of an order", async () => {
    Order.findByPk.mockResolvedValue({ id: 10, number: 10 });

    await expect(repository.findOrderNumber(10)).resolves.toEqual({
      id: 10,
      number: 10,
    });
    expect(Order.findByPk).toHaveBeenCalledWith(10, {
      attributes: ["id", "number"],
    });
  });
});
