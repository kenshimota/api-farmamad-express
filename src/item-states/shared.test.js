jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const ItemState = require("../models/item-state");
const {
  handleDeleteError,
  handleWriteError,
  loadItemState,
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
  ItemState.findByPk.mockReset();
});

describe("loadItemState", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadItemState({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid item state id" } });
    expect(ItemState.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the item state does not exist", async () => {
    ItemState.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadItemState({ params: { id: "999" } }, res, next);

    expect(ItemState.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Item state not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the item state and continues when it exists", async () => {
    const itemState = { id: 1, name: "sellable", label: "Vendible" };
    ItemState.findByPk.mockResolvedValue(itemState);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadItemState(req, res, next);

    expect(ItemState.findByPk).toHaveBeenCalledWith(1);
    expect(req.item_state).toBe(itemState);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the item state already exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Item state already exists" });
  });

  it("answers 409 when a foreign key blocks renaming an item state", () => {
    const res = response();

    handleWriteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Item state is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when the item state is in use", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Item state is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
