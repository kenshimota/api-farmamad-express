jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/city", () => ({ findByPk: jest.fn() }));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/purchase", () => ({ findOne: jest.fn() }));

const { Op } = require("sequelize");
const Supplier = require("../models/supplier");
const City = require("../models/city");
const State = require("../models/state");
const Purchase = require("../models/purchase");
const {
  createSupplierRepository,
  LIST_ORDER,
  LOCATION_INCLUDE,
} = require("./repository");

const repository = createSupplierRepository();

const VALUES = {
  name: "Distribuidora La Salud C.A.",
  identification: "J-12345678-9",
  email: "ventas@lasalud.com",
  phone: "+58 212 555-1234",
  observations: "Entrega los martes",
  address: "Av. Principal, Galpón 4",
  city_id: 10,
  state_id: 4,
};

beforeEach(() => {
  Supplier.create.mockReset();
  Supplier.findAll.mockReset();
  Supplier.findByPk.mockReset();
  City.findByPk.mockReset();
  State.findByPk.mockReset();
  Purchase.findOne.mockReset();
});

describe("supplierRepository", () => {
  it("creates a supplier through the model", async () => {
    const created = { id: 1, ...VALUES };
    Supplier.create.mockResolvedValue(created);

    await expect(repository.create(VALUES)).resolves.toBe(created);
    expect(Supplier.create).toHaveBeenCalledWith(VALUES);
  });

  it("lists suppliers ordered by name and includes the location", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(LIST_ORDER).toEqual([["name", "ASC"]]);
    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
    });
  });

  it("filters by state_id and city_id", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await repository.list({ stateId: 4, cityId: 10 });

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: { state_id: 4, city_id: 10 },
    });
  });

  it("searches partially and case-insensitively by name or identification", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await repository.list({ q: "  salud " });

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: "%salud%" } },
          { identification: { [Op.iLike]: "%salud%" } },
        ],
      },
    });
  });

  it("combines the filters with the search term", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await repository.list({ stateId: 4, cityId: 10, q: "salud" });

    expect(Supplier.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
      where: {
        state_id: 4,
        city_id: 10,
        [Op.or]: [
          { name: { [Op.iLike]: "%salud%" } },
          { identification: { [Op.iLike]: "%salud%" } },
        ],
      },
    });
  });

  it("ignores blank and non-string search terms", async () => {
    Supplier.findAll.mockResolvedValue([]);

    await repository.list({ q: "   " });
    await repository.list({ q: ["salud"] });

    expect(Supplier.findAll).toHaveBeenCalledTimes(2);
    expect(Supplier.findAll).toHaveBeenNthCalledWith(1, {
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
    });
    expect(Supplier.findAll).toHaveBeenNthCalledWith(2, {
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
    });
  });

  it("finds a supplier by id with or without the location", async () => {
    const supplier = { id: 1 };
    Supplier.findByPk.mockResolvedValue(supplier);

    await expect(repository.findById(1)).resolves.toBe(supplier);
    await expect(
      repository.findById(1, { includeLocation: true }),
    ).resolves.toBe(supplier);

    expect(Supplier.findByPk).toHaveBeenNthCalledWith(1, 1);
    expect(Supplier.findByPk).toHaveBeenNthCalledWith(2, 1, {
      include: LOCATION_INCLUDE,
    });
  });

  it("updates and removes the loaded instance", async () => {
    const supplier = {
      update: jest.fn().mockResolvedValue({ id: 1 }),
      destroy: jest.fn().mockResolvedValue(),
    };

    await expect(
      repository.update(supplier, { name: "Nuevo" }),
    ).resolves.toEqual({ id: 1 });
    await expect(repository.remove(supplier)).resolves.toBeUndefined();

    expect(supplier.update).toHaveBeenCalledWith({ name: "Nuevo" });
    expect(supplier.destroy).toHaveBeenCalledTimes(1);
  });

  it("loads the city and tells whether a state exists", async () => {
    const city = { id: 10, state_id: 4 };
    City.findByPk.mockResolvedValue(city);
    State.findByPk.mockResolvedValueOnce({ id: 4 });
    State.findByPk.mockResolvedValueOnce(null);

    await expect(repository.findCity(10)).resolves.toBe(city);
    await expect(repository.stateExists(4)).resolves.toBe(true);
    await expect(repository.stateExists(999)).resolves.toBe(false);

    expect(City.findByPk).toHaveBeenCalledWith(10);
    expect(State.findByPk).toHaveBeenCalledWith(4);
    expect(State.findByPk).toHaveBeenCalledWith(999);
  });

  it("reports whether a purchase references the supplier", async () => {
    Purchase.findOne.mockResolvedValueOnce({ id: 5 });

    await expect(repository.hasPurchases(1)).resolves.toBe(true);
    expect(Purchase.findOne).toHaveBeenCalledWith({
      where: { supplier_id: 1 },
    });

    Purchase.findOne.mockResolvedValueOnce(null);

    await expect(repository.hasPurchases(2)).resolves.toBe(false);
    expect(Supplier.findByPk).not.toHaveBeenCalled();
    expect(Supplier.findAll).not.toHaveBeenCalled();
  });

  it("uses injected models instead of the defaults", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const cityModel = { findByPk: jest.fn().mockResolvedValue({ id: 10 }) };
    const stateModel = { findByPk: jest.fn().mockResolvedValue({ id: 4 }) };
    const injected = createSupplierRepository(model, cityModel, stateModel);

    await injected.create(VALUES);
    await injected.list();
    await injected.findById(1, { includeLocation: true });
    await injected.findCity(10);
    await injected.stateExists(4);

    expect(model.create).toHaveBeenCalledWith(VALUES);
    expect(model.findAll).toHaveBeenCalledWith({
      order: LIST_ORDER,
      include: LOCATION_INCLUDE,
    });
    expect(model.findByPk).toHaveBeenCalledWith(1, {
      include: LOCATION_INCLUDE,
    });
    expect(cityModel.findByPk).toHaveBeenCalledWith(10);
    expect(stateModel.findByPk).toHaveBeenCalledWith(4);
    expect(Supplier.create).not.toHaveBeenCalled();
  });
});
