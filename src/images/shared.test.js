jest.mock("../models/image", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Image = require("../models/image");
const { handleDeleteError, handleWriteError, loadImage } = require("./shared");

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
  Image.findByPk.mockReset();
});

describe("loadImage", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadImage({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid image id" } });
    expect(Image.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the image does not exist", async () => {
    Image.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadImage({ params: { id: "999" } }, res, next);

    expect(Image.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Image not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the image and continues when it exists", async () => {
    const image = { id: 1, reference: "ibuprofeno-400" };
    Image.findByPk.mockResolvedValue(image);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadImage(req, res, next);

    expect(Image.findByPk).toHaveBeenCalledWith(1);
    expect(req.image).toBe(image);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the reference already exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Image already exists" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when a product references the image", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Image is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
