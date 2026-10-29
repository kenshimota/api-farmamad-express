jest.mock("../models/city", () => ({ findByPk: jest.fn() }));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const City = require("../models/city");
const State = require("../models/state");
const {
  ensureState,
  handleDeleteError,
  handleWriteError,
  loadCity,
} = require("./shared");

/**
 * Builds a minimal Express response double that records the status and body.
 * @returns {object} Response double with status and json spies.
 */
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

beforeEach(() => {
  City.findByPk.mockReset();
  State.findByPk.mockReset();
});

describe("loadCity", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadCity({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid city id" } });
    expect(City.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the city does not exist", async () => {
    City.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadCity({ params: { id: "999" } }, res, next);

    expect(City.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "City not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the city and continues when it exists", async () => {
    const city = { id: 10, name: "Maracay", state_id: 4 };
    City.findByPk.mockResolvedValue(city);
    const req = { params: { id: "10" } };
    const res = response();
    const next = jest.fn();

    await loadCity(req, res, next);

    expect(City.findByPk).toHaveBeenCalledWith(10);
    expect(req.city).toBe(city);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("ensureState", () => {
  it("answers 422 when the referenced state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await ensureState({ validated: { state_id: 999 } }, res, next);

    expect(State.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { state_id: "Invalid state" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when the referenced state exists", async () => {
    State.findByPk.mockResolvedValue({ id: 4 });
    const res = response();
    const next = jest.fn();

    await ensureState({ validated: { state_id: 4 } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("continues without checking when state_id is omitted", async () => {
    const res = response();
    const next = jest.fn();

    await ensureState({ validated: { name: "Maracay" } }, res, next);

    expect(State.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the city already exists in the state", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "City already exists" });
  });

  it("answers 422 when a foreign key points to a missing state", () => {
    const res = response();

    handleWriteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { state_id: "Invalid state" } });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when a supplier references the city", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "City is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
