jest.mock("../models/price-list", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/customer", () => ({ count: jest.fn() }));

const PriceList = require("../models/price-list");
const Customer = require("../models/customer");
const { createPriceListRepository, LIST_ORDER } = require("./repository");

beforeEach(() => {
  PriceList.create.mockReset();
  PriceList.findAll.mockReset();
  PriceList.findByPk.mockReset();
  Customer.count.mockReset();
});

describe("price list repository", () => {
  const repository = createPriceListRepository({
    model: PriceList,
    customerModel: Customer,
  });

  it("lists price lists ordered by name and id", async () => {
    PriceList.findAll.mockResolvedValue([]);

    await repository.list();

    expect(PriceList.findAll).toHaveBeenCalledWith({ order: LIST_ORDER });
    expect(LIST_ORDER).toEqual([
      ["name", "ASC"],
      ["id", "ASC"],
    ]);
  });

  it("creates, loads, updates and removes through the model", async () => {
    const stored = { id: 1, name: "Mayorista" };
    PriceList.create.mockResolvedValue(stored);
    PriceList.findByPk.mockResolvedValue(stored);

    await expect(repository.create({ name: "Mayorista" })).resolves.toBe(
      stored,
    );
    await expect(repository.findById(1)).resolves.toBe(stored);

    const instance = {
      id: 1,
      update: jest.fn().mockResolvedValue(),
      destroy: jest.fn().mockResolvedValue(),
    };
    PriceList.findByPk.mockResolvedValue(instance);

    await repository.update(instance, { name: "Nuevo" });
    expect(instance.update).toHaveBeenCalledWith({ name: "Nuevo" });
    expect(PriceList.findByPk).toHaveBeenCalledWith(1);

    await repository.remove(instance);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("counts the customers assigned to a list", async () => {
    Customer.count.mockResolvedValue(3);

    await expect(repository.countCustomers(1)).resolves.toBe(3);
    expect(Customer.count).toHaveBeenCalledWith({
      where: { price_list_id: 1 },
    });
  });
});
