jest.mock("../models/category", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Category = require("../models/category");
const {
  handleDeleteError,
  handleWriteError,
  loadCategory,
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
  Category.findByPk.mockReset();
});

describe("loadCategory", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadCategory({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid category id" } });
    expect(Category.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the category does not exist", async () => {
    Category.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadCategory({ params: { id: "999" } }, res, next);

    expect(Category.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Category not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the category and continues when it exists", async () => {
    const category = { id: 1, name: "Analgésicos" };
    Category.findByPk.mockResolvedValue(category);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadCategory(req, res, next);

    expect(Category.findByPk).toHaveBeenCalledWith(1);
    expect(req.category).toBe(category);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the name already exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Category already exists" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when a product references the category", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Category is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
