jest.mock("../models/city", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));

const City = require("../models/city");
const State = require("../models/state");
const { createCityRepository, LIST_ORDER } = require("./repository");

const repository = createCityRepository();

beforeEach(() => {
  City.create.mockReset();
  City.findAll.mockReset();
  City.findByPk.mockReset();
  State.findByPk.mockReset();
});

describe("cityRepository", () => {
  it("creates a city through the model", async () => {
    const values = { name: "Maracay", state_id: 4 };
    const created = { id: 10, ...values };
    City.create.mockResolvedValue(created);

    await expect(repository.create(values)).resolves.toBe(created);
    expect(City.create).toHaveBeenCalledWith(values);
  });

  it("lists cities ordered by id ascending", async () => {
    City.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
    expect(LIST_ORDER).toEqual([["id", "ASC"]]);
  });

  it("filters by state_id when requested", async () => {
    City.findAll.mockResolvedValue([]);

    await repository.list({ stateId: 4 });

    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      where: { state_id: 4 },
    });
  });

  it("includes the nested state when requested", async () => {
    City.findAll.mockResolvedValue([]);

    await repository.list({ includeState: true });

    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      include: [{ model: State, as: "state" }],
    });
  });

  it("combines the state filter and the nested state", async () => {
    City.findAll.mockResolvedValue([]);

    await repository.list({ stateId: 4, includeState: true });

    expect(City.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      where: { state_id: 4 },
      include: [{ model: State, as: "state" }],
    });
  });

  it("finds a city by id", async () => {
    const city = { id: 10 };
    City.findByPk.mockResolvedValue(city);

    await expect(repository.findById(10)).resolves.toBe(city);
    expect(City.findByPk).toHaveBeenCalledWith(10);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 10 };
    const city = { update: jest.fn().mockResolvedValue(updated) };
    const values = { name: "Maracay" };

    await expect(repository.update(city, values)).resolves.toBe(updated);
    expect(city.update).toHaveBeenCalledWith(values);
  });

  it("removes the loaded instance", async () => {
    const city = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(city)).resolves.toBeUndefined();
    expect(city.destroy).toHaveBeenCalledTimes(1);
  });

  it("tells whether the state exists", async () => {
    State.findByPk.mockResolvedValueOnce({ id: 4 });
    State.findByPk.mockResolvedValueOnce(null);

    await expect(repository.stateExists(4)).resolves.toBe(true);
    await expect(repository.stateExists(999)).resolves.toBe(false);
    expect(State.findByPk).toHaveBeenCalledWith(4);
    expect(State.findByPk).toHaveBeenCalledWith(999);
  });

  it("uses injected models instead of the defaults", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const stateModel = { findByPk: jest.fn().mockResolvedValue({ id: 4 }) };
    const injected = createCityRepository(model, stateModel);

    await injected.create({ name: "Maracay", state_id: 4 });
    await injected.list();
    await injected.findById(1);
    await injected.stateExists(4);

    expect(model.create).toHaveBeenCalledWith({
      name: "Maracay",
      state_id: 4,
    });
    expect(model.findAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
    });
    expect(model.findByPk).toHaveBeenCalledWith(1);
    expect(stateModel.findByPk).toHaveBeenCalledWith(4);
    expect(City.create).not.toHaveBeenCalled();
  });
});
