jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/category", () => ({ findByPk: jest.fn() }));
jest.mock("../models/image", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Product = require("../models/product");
const Category = require("../models/category");
const Image = require("../models/image");
const { ensureReferences, handleWriteError, loadProduct } = require("./shared");

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
  Product.findByPk.mockReset();
  Category.findByPk.mockReset();
  Image.findByPk.mockReset();
  Category.findByPk.mockResolvedValue({ id: 1 });
  Image.findByPk.mockResolvedValue({ id: 2 });
});

describe("loadProduct", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadProduct({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid product id" } });
    expect(Product.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the product does not exist", async () => {
    Product.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadProduct({ params: { id: "999" } }, res, next);

    expect(Product.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Product not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the product and continues when it exists", async () => {
    const product = { id: 1, reference: "IBU-400" };
    Product.findByPk.mockResolvedValue(product);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadProduct(req, res, next);

    expect(Product.findByPk).toHaveBeenCalledWith(1);
    expect(req.product).toBe(product);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("ensureReferences", () => {
  it("continues when both references exist", async () => {
    const req = { validated: { category_id: 1, image_id: 2 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(Category.findByPk).toHaveBeenCalledWith(1);
    expect(Image.findByPk).toHaveBeenCalledWith(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("answers 422 when the category does not exist", async () => {
    Category.findByPk.mockResolvedValue(null);
    const req = { validated: { category_id: 99, image_id: 2 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
    expect(Image.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 422 when the image does not exist", async () => {
    Image.findByPk.mockResolvedValue(null);
    const req = { validated: { category_id: 1, image_id: 99 } };
    const res = response();
    const next = jest.fn();

    await ensureReferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { image_id: "Invalid image id" } });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the reference already exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Product already exists" });
  });

  it("maps a category foreign key error to 422", () => {
    const res = response();
    const error = new ForeignKeyConstraintError({
      message: "foreign key",
      fields: { category_id: 99 },
    });

    handleWriteError(error, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
  });

  it("maps an image foreign key error to 422", () => {
    const res = response();
    const error = new ForeignKeyConstraintError({
      message: "foreign key",
      fields: ["image_id"],
    });

    handleWriteError(error, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { image_id: "Invalid image id" } });
  });

  it("maps an unlabelled foreign key error from its message", () => {
    const res = response();
    const error = new ForeignKeyConstraintError({
      message: 'violates foreign key constraint "products_category_id_fkey"',
    });

    handleWriteError(error, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { category_id: "Invalid category id" },
    });
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
