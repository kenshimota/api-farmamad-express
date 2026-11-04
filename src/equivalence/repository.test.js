const { createEquivalenceRepository } = require("./repository");

function buildRepository() {
  const currencyModel = {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  };
  const historyModel = { findAll: jest.fn() };
  const orderModel = { findByPk: jest.fn() };
  const repository = createEquivalenceRepository({
    currencyModel,
    historyModel,
    orderModel,
  });

  return { repository, currencyModel, historyModel, orderModel };
}

describe("equivalence repository", () => {
  it("loads a currency by primary key", async () => {
    const { repository, currencyModel } = buildRepository();
    const currency = { id: 3, code: "USD_BCV" };
    currencyModel.findByPk.mockResolvedValue(currency);

    await expect(repository.findCurrencyById(3)).resolves.toBe(currency);
    expect(currencyModel.findByPk).toHaveBeenCalledWith(3);
  });

  it("loads the base currency", async () => {
    const { repository, currencyModel } = buildRepository();
    currencyModel.findOne.mockResolvedValue({ id: 1, is_base: true });

    await expect(repository.findBaseCurrency()).resolves.toMatchObject({
      id: 1,
    });
    expect(currencyModel.findOne).toHaveBeenCalledWith({
      where: { is_base: true },
    });
  });

  it("returns the newest change per currency, ignoring duplicates", async () => {
    const { repository, historyModel } = buildRepository();
    const first = new Date("2026-11-01T00:00:00.000Z");
    const second = new Date("2026-11-02T00:00:00.000Z");

    historyModel.findAll.mockResolvedValue([
      { currency_id: 3, changed_at: second },
      { currency_id: 1, changed_at: first },
      { currency_id: 3, changed_at: first },
    ]);

    await expect(repository.findLatestRateChanges([3, 1, 3])).resolves.toEqual({
      3: second,
      1: first,
    });
    expect(historyModel.findAll).toHaveBeenCalledWith({
      where: { currency_id: { [require("sequelize").Op.in]: [3, 1] } },
      order: [
        ["changed_at", "DESC"],
        ["id", "DESC"],
      ],
    });
  });

  it("does not query history when there are no ids", async () => {
    const { repository, historyModel } = buildRepository();

    await expect(repository.findLatestRateChanges([])).resolves.toEqual({});
    expect(historyModel.findAll).not.toHaveBeenCalled();
  });

  it("returns null for a missing or absent order number", async () => {
    const { repository, orderModel } = buildRepository();

    await expect(repository.findOrderNumber(null)).resolves.toBeNull();
    expect(orderModel.findByPk).not.toHaveBeenCalled();

    orderModel.findByPk.mockResolvedValue(null);
    await expect(repository.findOrderNumber(99)).resolves.toBeNull();
  });

  it("returns the numeric order number", async () => {
    const { repository, orderModel } = buildRepository();

    orderModel.findByPk.mockResolvedValue({ id: 10, number: "10" });

    await expect(repository.findOrderNumber(10)).resolves.toBe(10);
    expect(orderModel.findByPk).toHaveBeenCalledWith(10, {
      attributes: ["id", "number"],
    });
  });
});
