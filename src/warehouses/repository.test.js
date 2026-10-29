jest.mock("../models/warehouse", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

const { Op } = require("sequelize");
const Warehouse = require("../models/warehouse");
const { buildListOptions, createWarehouseRepository } = require("./repository");

const repository = createWarehouseRepository();

beforeEach(() => {
  Warehouse.create.mockReset();
  Warehouse.findAll.mockReset();
  Warehouse.findByPk.mockReset();
});

describe("warehouseRepository", () => {
  it("creates a warehouse through the model", async () => {
    const values = { name: "Bodega Central", address: "Av. 123" };
    const created = { id: 1, ...values };
    Warehouse.create.mockResolvedValue(created);

    await expect(repository.create(values)).resolves.toBe(created);
    expect(Warehouse.create).toHaveBeenCalledWith(values);
  });

  it("lists warehouses ordered by id when there is no search", async () => {
    Warehouse.findAll.mockResolvedValue([]);

    await expect(repository.list(undefined)).resolves.toEqual([]);
    expect(Warehouse.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
  });

  it("lists warehouses with the normalized search filter", async () => {
    Warehouse.findAll.mockResolvedValue([]);

    await repository.list("  central  ");

    expect(Warehouse.findAll).toHaveBeenCalledWith({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%central%" } },
          { observations: { [Op.iLike]: "%central%" } },
          { address: { [Op.iLike]: "%central%" } },
        ],
      },
      order: [["id", "ASC"]],
    });
  });

  it("finds a warehouse by id", async () => {
    const warehouse = { id: 3 };
    Warehouse.findByPk.mockResolvedValue(warehouse);

    await expect(repository.findById(3)).resolves.toBe(warehouse);
    expect(Warehouse.findByPk).toHaveBeenCalledWith(3);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 1 };
    const warehouse = { update: jest.fn().mockResolvedValue(updated) };
    const values = { name: "Bodega Sur" };

    await expect(repository.update(warehouse, values)).resolves.toBe(updated);
    expect(warehouse.update).toHaveBeenCalledWith(values);
  });

  it("removes the loaded instance", async () => {
    const warehouse = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(warehouse)).resolves.toBeUndefined();
    expect(warehouse.destroy).toHaveBeenCalledTimes(1);
  });
});

describe("buildListOptions", () => {
  it.each([undefined, null, "", "   ", ["central"], { a: 1 }])(
    "omits the where clause for %p",
    (search) => {
      expect(buildListOptions(search)).toEqual({
        order: [["id", "ASC"]],
      });
    },
  );
});
