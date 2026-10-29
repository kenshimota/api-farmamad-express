jest.mock("../models/state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

const State = require("../models/state");
const { createStateRepository, LIST_ORDER } = require("./repository");

const repository = createStateRepository();

beforeEach(() => {
  State.create.mockReset();
  State.findAll.mockReset();
  State.findByPk.mockReset();
});

describe("stateRepository", () => {
  it("creates a state through the model", async () => {
    const values = { name: "Aragua", code: "VE-D" };
    const created = { id: 1, ...values };
    State.create.mockResolvedValue(created);

    await expect(repository.create(values)).resolves.toBe(created);
    expect(State.create).toHaveBeenCalledWith(values);
  });

  it("lists states ordered by name ascending", async () => {
    State.findAll.mockResolvedValue([]);

    await expect(repository.list()).resolves.toEqual([]);
    expect(State.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
    });
    expect(LIST_ORDER).toEqual([["name", "ASC"]]);
  });

  it("finds a state by id", async () => {
    const state = { id: 3 };
    State.findByPk.mockResolvedValue(state);

    await expect(repository.findById(3)).resolves.toBe(state);
    expect(State.findByPk).toHaveBeenCalledWith(3);
  });

  it("updates the loaded instance", async () => {
    const updated = { id: 1 };
    const state = { update: jest.fn().mockResolvedValue(updated) };
    const values = { name: "Aragua" };

    await expect(repository.update(state, values)).resolves.toBe(updated);
    expect(state.update).toHaveBeenCalledWith(values);
  });

  it("removes the loaded instance", async () => {
    const state = { destroy: jest.fn().mockResolvedValue() };

    await expect(repository.remove(state)).resolves.toBeUndefined();
    expect(state.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses an injected model instead of the default one", async () => {
    const model = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    };
    const injected = createStateRepository(model);

    await injected.create({ name: "Aragua", code: "VE-D" });
    await injected.list();
    await injected.findById(1);

    expect(model.create).toHaveBeenCalledWith({
      name: "Aragua",
      code: "VE-D",
    });
    expect(model.findAll).toHaveBeenCalledWith({
      order: [["name", "ASC"]],
    });
    expect(model.findByPk).toHaveBeenCalledWith(1);
    expect(State.create).not.toHaveBeenCalled();
  });
});
