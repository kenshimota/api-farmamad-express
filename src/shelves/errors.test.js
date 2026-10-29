const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const {
  handleSectionDeleteError,
  handleSectionWriteError,
  handleShelfDeleteError,
  handleShelfWriteError,
  httpError,
  isHttpError,
  sectionHasLots,
  shelfAlreadyExists,
  shelfHasLots,
} = require("./errors");

/**
 * Builds an Express response double.
 * @returns {object} The response double.
 */
function responseDouble() {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
}

describe("shelf errors", () => {
  it("sends controlled HTTP errors", () => {
    const error = httpError(404, { message: "Shelf not found" });
    const res = responseDouble();

    expect(isHttpError(error)).toBe(true);
    expect(handleShelfWriteError(error, res)).toBe(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Shelf not found" });
  });

  it("maps a foreign key to an invalid warehouse on writes", () => {
    const res = responseDouble();

    handleShelfWriteError(
      new ForeignKeyConstraintError({ message: "fk" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      errors: { warehouse_id: "Invalid warehouse id" },
    });
  });

  it("maps a unique violation to Shelf already exists", () => {
    const res = responseDouble();

    handleShelfWriteError(new UniqueConstraintError({ message: "dup" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Shelf already exists",
    });
  });

  it("maps delete foreign keys to Shelf has lots", () => {
    const res = responseDouble();

    handleShelfDeleteError(
      new ForeignKeyConstraintError({ message: "fk" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Shelf has lots" });
  });

  it("forwards controlled errors from the delete handler", () => {
    const res = responseDouble();
    const error = httpError(409, { message: "Shelf has lots" });

    handleShelfDeleteError(error, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Shelf has lots" });
  });

  it("rethrows unknown shelf errors", () => {
    const error = new Error("boom");

    expect(() => handleShelfWriteError(error, responseDouble())).toThrow(error);
    expect(() => handleShelfDeleteError(error, responseDouble())).toThrow(
      error,
    );
  });
});

describe("section errors", () => {
  it("sends controlled HTTP errors", () => {
    const res = responseDouble();

    handleSectionWriteError(sectionHasLots(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Section has lots" });
  });

  it("maps a foreign key to an invalid shelf on writes", () => {
    const res = responseDouble();

    handleSectionWriteError(
      new ForeignKeyConstraintError({ message: "fk" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      errors: { shelf_id: "Invalid shelf id" },
    });
  });

  it("maps a unique violation to Section already exists", () => {
    const res = responseDouble();

    handleSectionWriteError(new UniqueConstraintError({ message: "dup" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Section already exists",
    });
  });

  it("maps delete foreign keys to Section has lots", () => {
    const res = responseDouble();

    handleSectionDeleteError(
      new ForeignKeyConstraintError({ message: "fk" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Section has lots" });
  });

  it("forwards controlled errors from the delete handler", () => {
    const res = responseDouble();

    handleSectionDeleteError(sectionHasLots(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Section has lots" });
  });

  it("rethrows unknown section errors", () => {
    const error = new Error("boom");

    expect(() => handleSectionWriteError(error, responseDouble())).toThrow(
      error,
    );
    expect(() => handleSectionDeleteError(error, responseDouble())).toThrow(
      error,
    );
  });

  it("exposes the shelf builders used by the delete handler", () => {
    expect(shelfHasLots().body).toEqual({ message: "Shelf has lots" });
    expect(shelfAlreadyExists().body).toEqual({
      message: "Shelf already exists",
    });
  });
});
