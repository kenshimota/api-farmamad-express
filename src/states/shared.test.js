jest.mock("../models/state", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const State = require("../models/state");
const { handleDeleteError, handleWriteError, loadState } = require("./shared");

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
  State.findByPk.mockReset();
});

describe("loadState", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadState({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid state id" } });
    expect(State.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the state does not exist", async () => {
    State.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadState({ params: { id: "999" } }, res, next);

    expect(State.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "State not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the state and continues when it exists", async () => {
    const state = { id: 1, name: "Aragua", code: "VE-D" };
    State.findByPk.mockResolvedValue(state);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadState(req, res, next);

    expect(State.findByPk).toHaveBeenCalledWith(1);
    expect(req.state).toBe(state);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the state already exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "State already exists" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when the state has cities", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "State has cities" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
