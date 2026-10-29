jest.mock("../models/cost", () => ({ findByPk: jest.fn() }));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Cost = require("../models/cost");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const {
  ensureReferences,
  handleDeleteError,
  handleWriteError,
  loadCost,
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
  Cost.findByPk.mockReset();
  Product.findByPk.mockReset();
  ItemState.findByPk.mockReset();
  Product.findByPk.mockResolvedValue({ id: 1 });
  ItemState.findByPk.mockResolvedValue({ id: 2 });
});

describe("loadCost", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadCost({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid cost id" } });
    expect(Cost.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the cost does not exist", async () => {
    Cost.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadCost({ params: { id: "999" } }, res, next);

    expect(Cost.findByPk).toHaveBeenCalledWith(999, expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Cost not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the cost and continues when it exists", async () => {
    const cost = { id: 1, cost: "12.50" };
    Cost.findByPk.mockResolvedValue(cost);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadCost(req, res, next);

    expect(Cost.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
    expect(req.cost).toBe(cost);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("ensureReferences", () => {
  it("continues when both references exist", async () => {
    const req = { validated: { product_id: 1, item_state_id: 2 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(Product.findByPk).toHaveBeenCalledWith(1);
    expect(ItemState.findByPk).toHaveBeenCalledWith(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("answers 422 when the product does not exist", async () => {
    Product.findByPk.mockResolvedValue(null);
    const req = { validated: { product_id: 99, item_state_id: 2 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { product_id: "Invalid product" } });
    expect(ItemState.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 422 when the item state does not exist", async () => {
    ItemState.findByPk.mockResolvedValue(null);
    const req = { validated: { product_id: 1, item_state_id: 99 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("checks only the provided references on a partial update", async () => {
    const req = { validated: { cost: 20 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(Product.findByPk).not.toHaveBeenCalled();
    expect(ItemState.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the product and item state combination exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Cost already exists" });
  });

  it("maps a product foreign key error to 422", () => {
    const res = response();

    handleWriteError(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: { product_id: 99 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { product_id: "Invalid product" } });
  });

  it("maps an item state foreign key error to 422", () => {
    const res = response();

    handleWriteError(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: ["item_state_id"],
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
  });

  it("maps an unlabelled foreign key error from its message", () => {
    const res = response();

    handleWriteError(
      new ForeignKeyConstraintError({
        message: 'violates foreign key constraint "costs_product_id_fkey"',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { product_id: "Invalid product" } });
  });

  it("rethrows a foreign key error for an unrelated field", () => {
    const error = new ForeignKeyConstraintError({
      message: "foreign key",
      fields: { other_id: 1 },
    });

    expect(() => handleWriteError(error, response())).toThrow(error);
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when another row references the cost", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Cost is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
